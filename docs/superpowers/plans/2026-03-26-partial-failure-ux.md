# Partial Failure UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show users their partially-generated images, refund only the unfulfilled portion, and let them retry the missing images via failed slots in generation history.

**Architecture:** Worker Path 2 changes from FAILED→COMPLETED with errorMessage, preserves original imageCount so the frontend can derive failed slot count. Retry config reduced from ~100 min to ~13 min. GenerationGroup renders amber failed slots with retry capability, cleared on successful extension.

**Tech Stack:** Next.js, React, Prisma, BullMQ worker, TypeScript

---

### Task 1: Update Retry Config

**Files:**
- Modify: `worker/src/lib/constants.ts:47-49`

- [ ] **Step 1: Update retry constants**

```typescript
export const RETRY_DELAYS = [10_000, 30_000, 60_000, 90_000, 120_000] as const;
export const MAX_OTHER_RETRIES = 5;
export const MAX_HIGH_DEMAND_RETRIES = 10;
```

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/constants.ts
git commit -m "feat: reduce retry limits and increase delays (max ~13 min)"
```

---

### Task 2: Extend COMPLETED Event Type + WebSocket Client

The `GenerationEvent` COMPLETED type currently carries no payload. We need to add an optional `errorMessage` so WebSocket clients can show warning toasts for partial failures.

**Files:**
- Modify: `worker/src/lib/progress.ts:9`
- Modify: `src/lib/use-generation-ws.ts` (COMPLETED case handler)

- [ ] **Step 1: Extend GenerationEvent COMPLETED type**

In `worker/src/lib/progress.ts`, update the COMPLETED variant:

```typescript
  | { type: typeof EVENT_TYPE.COMPLETED; errorMessage?: string }
```

- [ ] **Step 2: Handle errorMessage in WebSocket client**

In `src/lib/use-generation-ws.ts`, find the `case EVENT_TYPE.COMPLETED:` handler and extract `errorMessage`:

```typescript
case EVENT_TYPE.COMPLETED:
  status = GENERATION_STATUS.COMPLETED;
  errorMessage = (data as { errorMessage?: string }).errorMessage ?? null;
  break;
```

- [ ] **Step 3: Type-check both**

Run: `npx tsc --noEmit && cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add worker/src/lib/progress.ts src/lib/use-generation-ws.ts
git commit -m "feat: add errorMessage to COMPLETED WebSocket event"
```

---

### Task 3: Worker Path 2 — COMPLETED with errorMessage

Both processors have identical Path 2 code. Change status from FAILED→COMPLETED, preserve original `imageCount`, set human-readable `errorMessage`.

**Files:**
- Modify: `worker/src/processors/generation.processor.ts:234-261`
- Modify: `worker/src/processors/inpaint.processor.ts:236-263` (identical change)

- [ ] **Step 1: Update Path 2 in generation.processor.ts**

Replace the Path 2 block (after the cancellation guard and extension Path 1) with:

```typescript
    // Path 2: Partial success (some images created before error)
    const existingImages = await prisma.generatedImage.count({
      where: { generationId },
    });
    if (existingImages > 0) {
      const perImageCost = CREDIT_COST_PER_IMAGE[job.data.model];
      if (perImageCost === undefined) throw new Error(`Unknown model "${job.data.model}"`);
      const costForCreated = perImageCost * existingImages;
      const partialRefund = Math.max(0, job.data.creditCost - costForCreated);
      const requestedCount = job.data.imageCount ?? existingImages;

      const updated = await prisma.generation.updateMany({
        where: { id: generationId, status: { not: GENERATION_STATUS.FAILED } },
        data: {
          status: GENERATION_STATUS.COMPLETED,
          errorMessage: `${existingImages} of ${requestedCount} images generated. ${partialRefund} credits refunded.`,
          creditCost: costForCreated,
          // imageCount intentionally NOT updated — preserve original requested count
          // so frontend can calculate failed slots: imageCount - images.length
        },
      });
      if (updated.count > 0 && partialRefund > 0) {
        await refundCredits(job.data.userId, generationId, partialRefund);
      }
      const partialMsg = `${existingImages} of ${requestedCount} images generated. ${partialRefund} credits refunded.`;
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.COMPLETED,
        errorMessage: partialMsg,
      });
      throw new UnrecoverableError(errorMsg);
    }
```

Key changes from current code:
- `status: COMPLETED` instead of `FAILED`
- `errorMessage` set to human-readable partial failure message
- `imageCount` NOT overwritten (was `imageCount: existingImages`)
- Publishes `EVENT_TYPE.COMPLETED` with `errorMessage` (so WebSocket clients get it too)

- [ ] **Step 2: Apply identical change to inpaint.processor.ts**

Same replacement in the inpaint processor's Path 2 block.

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add worker/src/processors/generation.processor.ts worker/src/processors/inpaint.processor.ts
git commit -m "fix: mark partial success as COMPLETED with errorMessage, preserve imageCount"
```

---

### Task 4: Worker — Clear/Update errorMessage on Extension

**Files:**
- Modify: `worker/src/processors/generation.processor.ts` — success path (~line 168-171) and extension Path 1 (~line 204-212)
- Modify: `worker/src/processors/inpaint.processor.ts` — same locations

- [ ] **Step 1: Clear errorMessage on successful completion (generation.processor.ts)**

Update the success path's generation update (currently `data: { status: GENERATION_STATUS.COMPLETED }`) to also clear `errorMessage`:

```typescript
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: GENERATION_STATUS.COMPLETED, errorMessage: null },
    });
```

- [ ] **Step 2: Update errorMessage on extension partial failure (generation.processor.ts)**

In extension Path 1, when `newImagesCreated > 0`, add `errorMessage` to the update:

```typescript
      if (newImagesCreated > 0) {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: GENERATION_STATUS.COMPLETED,
            imageCount: actualCount,
            creditCost: { decrement: refundAmount },
            errorMessage: refundAmount > 0
              ? `${actualCount} of ${gen?.imageCount ?? actualCount} images generated. ${refundAmount} credits refunded.`
              : null,
          },
        });
      }
```

- [ ] **Step 3: Update errorMessage in extension Path 1 `else` branch (zero new images)**

In extension Path 1, when `newImagesCreated === 0` (the `else` branch), also update `errorMessage` so stale messages from a prior partial failure are refreshed:

```typescript
      } else {
        // No new images — revert to pre-extension state
        const revertMsg = preExtensionCount < (gen?.imageCount ?? 0)
          ? `${preExtensionCount} of ${gen?.imageCount ?? preExtensionCount} images generated. ${job.data.creditCost} credits refunded.`
          : null;
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: GENERATION_STATUS.COMPLETED,
            imageCount: preExtensionCount,
            creditCost: { decrement: job.data.creditCost },
            errorMessage: revertMsg,
          },
        });
      }
```

- [ ] **Step 4: Apply same changes to inpaint.processor.ts**

All three: success path, extension Path 1 (`newImagesCreated > 0`), and extension Path 1 `else` branch.

- [ ] **Step 5: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add worker/src/processors/generation.processor.ts worker/src/processors/inpaint.processor.ts
git commit -m "feat: clear errorMessage on success, update on extension partial failure"
```

---

### Task 5: Frontend — Generation Type + Poller Toast

**Files:**
- Modify: `src/components/editor/types.ts:12-29`
- Modify: `src/components/editor/generation-poller.tsx:33-44`

- [ ] **Step 1: Add errorMessage to Generation interface**

In `src/components/editor/types.ts`, add to the `Generation` interface:

```typescript
export interface Generation {
  id: string;
  name?: string | null;
  status: GenerationStatus;
  createdAt: string | Date;
  imageCount?: number;
  jobType?: string;
  model?: string;
  prompt?: string;
  userPrompt?: string | null;
  images: GeneratedImage[];
  parentImageId?: string | null;
  parentImage?: { id: string; storageKey: string } | null;
  includeLayers?: boolean;
  attributeSnapshot?: unknown;
  descriptionSnapshot?: unknown;
  textLayerSnapshot?: unknown;
  errorMessage?: string | null;
}
```

- [ ] **Step 2: Update poller toast for partial completion**

In `generation-poller.tsx`, update the `handleComplete` function. Currently on non-failed completion it shows `toast.success("Cover generation complete!")`. It needs to check for `errorMessage` on the generation data from polling.

The poller receives `errorMessage` from WebSocket state and polling. For the COMPLETED path, the polling fallback at line 52-53 calls `handleComplete()` with no args. Update to pass the generation's errorMessage:

```typescript
  const handleComplete = (failed?: string, warning?: string) => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (failed) {
      toast.error(failed);
      onComplete?.(generationId, GENERATION_STATUS.FAILED);
    } else if (warning) {
      toast.warning(warning);
      onComplete?.(generationId, GENERATION_STATUS.COMPLETED);
    } else {
      toast.success("Cover generation complete!");
      onComplete?.(generationId, GENERATION_STATUS.COMPLETED);
    }
    router.refresh();
  };
```

Update the polling fallback (line 52-53):
```typescript
        if (data.status === GENERATION_STATUS.COMPLETED) {
          handleComplete(undefined, data.errorMessage ?? undefined);
```

Update the WebSocket status effect (line 77-78):
```typescript
    if (status === GENERATION_STATUS.COMPLETED) {
      handleComplete(undefined, errorMessage ?? undefined);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/types.ts src/components/editor/generation-poller.tsx
git commit -m "feat: add errorMessage to Generation type, warning toast for partial completion"
```

---

### Task 6: Frontend — Failed Slots in Generation History

**Files:**
- Modify: `src/components/editor/generation-group.tsx`

- [ ] **Step 1: Add `AlertTriangle` to lucide imports**

Add `AlertTriangle` to the existing lucide-react import at line 5.

- [ ] **Step 2: Calculate failedCount and adjust ghostCount**

After the existing `pendingCount` and `ghostCount` calculations (~lines 194-202), add:

```typescript
  const failedCount =
    !isActive && generation.errorMessage && (generation.imageCount ?? 0) > generation.images.length
      ? (generation.imageCount ?? 0) - generation.images.length
      : 0;

  const ghostCount =
    !isActive && generation.images.length + failedCount < MAX_GRID_SLOTS
      ? MAX_GRID_SLOTS - generation.images.length - failedCount
      : 0;
```

This replaces the existing `ghostCount` calculation. Failed slots take priority over ghost slots.

- [ ] **Step 3: Add amber warning in header**

After the image count display in the header (~line 270-275), when `errorMessage` is set, show amber text. Update the non-multiSelect branch:

```typescript
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {isActive
              ? (generation.images.length + pendingCount)
              : generation.images.length}
            <Images className="size-3.5" />
            {generation.errorMessage && !isActive && (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertTriangle className="size-3" />
                <span className="text-[10px]">
                  {generation.images.length} of {generation.imageCount} · partial
                </span>
              </span>
            )}
          </span>
        )}
```

- [ ] **Step 4: Render failed slots in grid**

After the pending slots array (`{Array.from({ length: pendingCount }, ...)}`) and before the ghost slots array, add the failed slots:

```typescript
              {Array.from({ length: failedCount }, (_, i) => (
                <button
                  key={`failed-${i}`}
                  onClick={() => onGenerateMore(generation, failedCount)}
                  className="w-full rounded-lg border-2 border-dashed border-amber-500/30
                             flex items-center justify-center cursor-pointer
                             hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors"
                  style={{ aspectRatio: "1600/2560" }}
                  title={`Retry ${failedCount} failed images`}
                >
                  <RefreshCw className="size-3.5 text-amber-500/50" />
                </button>
              ))}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/generation-group.tsx
git commit -m "feat: amber failed slots with retry in generation history"
```

---

### Task 7: CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Generation Pipeline section**

Add to the partial-failure handling paragraph (after "Both processors support `isExtension` flag..."):

```
**Partial failure status**: When some images are generated before an error (Path 2), the generation is marked `COMPLETED` (not `FAILED`) with `errorMessage` set to a human-readable summary (e.g., "4 of 8 images generated. 20 credits refunded."). The original `imageCount` is preserved (not overwritten to the actual count) so the frontend can compute failed slot count as `imageCount - images.length`. Only `creditCost` is adjusted. `errorMessage` is cleared on successful extension, or updated with fresh numbers on extension partial failure.
```

Update retry config documentation to reflect new values: `RETRY_DELAYS` 10s→30s→60s→90s→120s cap, `MAX_HIGH_DEMAND_RETRIES` 10 (total ~13 min), `MAX_OTHER_RETRIES` 5 (total ~5 min).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document partial failure UX and updated retry config"
```
