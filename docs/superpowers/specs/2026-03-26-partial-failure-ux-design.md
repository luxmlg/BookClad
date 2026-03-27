# Partial Failure UX Design

## Goal

When a generation partially succeeds (some images generated before an error), communicate clearly to the user what happened, show the images they got, refund only the unfulfilled portion, and let them retry the missing images.

## Current Behavior (broken)

1. Worker marks the generation as `FAILED` even though images exist
2. History filters out FAILED generations → user's images are invisible
3. Full credit cost was refunded (fixed in prior commit to partial refund, but status is still FAILED)
4. High-demand retries can run for ~100 min (99 retries × 60s cap)

## Design

### 1. Worker — Retry Config

Update `worker/src/lib/constants.ts`:
- `RETRY_DELAYS`: `[5_000, 15_000, 30_000, 60_000]` → `[10_000, 30_000, 60_000, 90_000, 120_000]`
- `MAX_HIGH_DEMAND_RETRIES`: `99` → `10`
- Total worst-case wait with 9 retries (attempt 10 fails permanently): 10+30+60+90+120×5 = 790s ≈ 13 min
- `MAX_OTHER_RETRIES` stays at `5` (total: 10+30+60+90+120 = 310s ≈ 5 min)

### 2. Worker — Path 2 Status & imageCount

Both `generation.processor.ts` and `inpaint.processor.ts`, Path 2 (partial success with existing images):

**Before**: Sets `status: FAILED`, `imageCount: existingImages`, `creditCost: costForCreated`.

**After**: Sets `status: COMPLETED`, keeps `imageCount` at the **originally requested** value (do NOT overwrite), sets `creditCost: costForCreated`, stores `errorMessage`:
```
`${existingImages} of ${imageCount} images generated. ${partialRefund} credits refunded.`
```

**Why keep original imageCount**: The frontend calculates failed slot count as `imageCount - images.length`. If we overwrite `imageCount` to `existingImages`, this difference is always 0 and failed slots never render. By preserving the original requested count, the difference naturally gives the number of failed slots.

The generation now appears in history because `historyGenerations` filters out `FAILED`, not `COMPLETED`.

**Note**: Path 2 fires `UnrecoverableError` — it cannot coexist with the retry path (Path 3/4). If images exist, Path 2 always runs. Therefore, partial images during RETRYING status is architecturally impossible under the current batch-generate design.

### 3. Worker — Clear/Update errorMessage on Extension

**On extension success** (both processors, success path): Clear `errorMessage`:
```typescript
await prisma.generation.update({
  where: { id: generationId },
  data: { status: GENERATION_STATUS.COMPLETED, errorMessage: null },
});
```

**On extension partial failure** (Path 1, `newImagesCreated > 0`): Update `errorMessage` with fresh numbers reflecting the current state, so stale messages from prior partial failures don't persist:
```
`${actualCount} of ${gen.imageCount} images generated. ${refundAmount} credits refunded.`
```

### 4. Frontend — Generation Type

Add `errorMessage` to `src/components/editor/types.ts`:
```typescript
export interface Generation {
  // ... existing fields
  errorMessage?: string | null;
}
```

No API/query changes needed — Prisma `include: { generations: { ... } }` in the editor page query already returns all Generation columns.

### 5. Frontend — Generation Poller Toast

`generation-poller.tsx`: When the poller detects `COMPLETED` status, check if the generation has `errorMessage`. If so, show `toast.warning(errorMessage)` instead of `toast.success("Cover generation complete!")`.

This requires the poller fallback (`getGeneration` API call) to return `errorMessage`. The existing GET API should already include it (Prisma returns all fields).

### 6. Frontend — Generation History (`generation-group.tsx`)

When a completed generation has `errorMessage` set:

**Header**: Show amber text next to the image count, e.g., "4 of 8 · partial refund"

**Grid — Failed slots**: Render after real images. Count = `(generation.imageCount ?? generation.images.length) - generation.images.length` (only when `errorMessage` is set and count > 0):
- Amber dashed border (`border-amber-500/30`)
- `RefreshCw` icon in amber
- Clickable — triggers `onGenerateMore(generation, failedCount)` to extend the generation

**Failed slots replace ghost slots**: When failed slots are present, reduce `ghostCount` accordingly so the total grid stays at `MAX_GRID_SLOTS`. Specifically: `ghostCount = MAX_GRID_SLOTS - generation.images.length - failedCount` (clamped to 0).

After a successful extension → worker clears `errorMessage` → `router.refresh()` → warning and failed slots disappear.

### 7. GET Generation API

Verify `GET /api/generations/[id]` (used by poller fallback) includes `errorMessage` in its response. If using explicit `select`, add `errorMessage: true`. If using `include` or no explicit select, it's already there.

### 8. CLAUDE.md

Update the Generation Pipeline section to document:
- Partial failure sets `COMPLETED` with `errorMessage` (not `FAILED`)
- `imageCount` preserved at originally requested value for failed slot rendering
- Only `creditCost` is adjusted to reflect actual images created
- Failed slots in history with retry capability

## Files to Modify

| File | Change |
|------|--------|
| `worker/src/lib/constants.ts` | Retry delays and max retries |
| `worker/src/processors/generation.processor.ts` | Path 2: FAILED→COMPLETED, keep imageCount, set errorMessage; Path 1: update errorMessage on partial extension failure; success path: clear errorMessage |
| `worker/src/processors/inpaint.processor.ts` | Same as generation processor |
| `src/components/editor/types.ts` | Add `errorMessage` to Generation |
| `src/components/editor/generation-poller.tsx` | Warning toast for partial completion |
| `src/components/editor/generation-group.tsx` | Amber warning header + failed slots with retry |
| `CLAUDE.md` | Document partial failure behavior |

## Out of Scope

- `imagesGenerated` in RETRYING WebSocket events (architecturally impossible — Path 2 fires before retry logic)
- Queue UI changes for showing partial progress during retrying (same reason)
- Credit transaction history showing "partial refund" (already logged correctly)
- Dashboard active-generation-row changes (low priority)
