# Auto-Retry for Failed Generations

## Goal

Automatically retry failed generations with smart backoff, distinguishing between high-demand (rate limiting) and other errors. Users see retry status in both the editor queue tab and dashboard, can cancel retries to get credits back, and have full visibility into what's happening.

## Architecture

BullMQ's built-in retry mechanism with a custom backoff strategy handles retry scheduling. The worker classifies errors as `high_demand` (429/503) or `error`, and applies different retry limits accordingly. A new `RETRYING` generation status drives UI state across the editor queue tab and dashboard. Credits stay reserved during retries and are refunded on cancellation or retry exhaustion.

## Data Model

### New `RETRYING` Status

Add `RETRYING` to the `JobStatus` enum in Prisma schema. Status flow:

```
QUEUED → PROCESSING → COMPLETED
                    → FAILED (permanent, credits refunded)
                    → RETRYING → PROCESSING (retry attempt starts)
                               → FAILED (max retries or user cancelled, credits refunded)
```

### New Fields on Generation

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `retryCount` | `Int` | `0` | Number of retry attempts so far |
| `retryReason` | `String?` | `null` | `"high_demand"` or `"error"` — drives retry limit and UI label |
| `nextRetryAt` | `DateTime?` | `null` | When the next retry is scheduled — drives countdown timer |

`errorMessage` (existing field) stores the latest error from the most recent failed attempt.

### Constants

Add to both `src/lib/constants.ts` and `worker/src/lib/constants.ts`:

```typescript
export const RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000] as const;
// Retries beyond the array length use the final value (60s)
export const MAX_OTHER_RETRIES = 5;
export const MAX_HIGH_DEMAND_RETRIES = 99;
```

Add `RETRYING` to `GENERATION_STATUS` and `RETRYING: "retrying"` to `EVENT_TYPE`.

## Worker Retry Logic

### BullMQ Job Configuration

Jobs are added to the queue with:

```typescript
queue.add(jobType, jobData, {
  attempts: 100,  // 99 retries + 1 initial attempt
  backoff: { type: "custom" },
});
```

The processor-side retry limits (`MAX_OTHER_RETRIES`, `MAX_HIGH_DEMAND_RETRIES`) are authoritative. BullMQ's `attempts: 100` is a ceiling — the processor throws `UnrecoverableError` to stop retries before that limit for non-high-demand errors.

Register a custom backoff strategy on the Worker:

```typescript
settings: {
  backoffStrategy: (attemptsMade: number) => {
    const idx = Math.min(attemptsMade - 1, RETRY_DELAYS.length - 1);
    return RETRY_DELAYS[idx]; // 5s → 15s → 30s → 60s cap
  },
}
```

### Catch Block Restructuring (Critical)

The existing catch blocks in both processors unconditionally call `refundCredits()` and set `status: FAILED` before re-throwing. This must be restructured for retry support. The new catch block flow:

1. **If extension (`isExtension` flag in job data):** use existing partial-success/non-retryable path unchanged. Extensions do not auto-retry — if the extension fails with zero new images, it fails permanently and refunds the extension credit cost. This avoids the complexity of distinguishing pre-existing images from newly created ones when counting for partial success.

2. **For non-extension jobs: check for partial success.** Count existing `GeneratedImage` rows for this generation. If any images were created during this attempt, fall through to the non-retryable path (mark `FAILED`, full refund). Do NOT retry — retrying would create duplicate images.

3. **Classify error:** check HTTP status for 429/503 → `high_demand`, else `error`.

4. **Determine if retryable** (using `attemptsMade + 1` to account for 0-based indexing):
   - `high_demand` and `attemptsMade + 1 < MAX_HIGH_DEMAND_RETRIES` → retryable
   - `error` and `attemptsMade + 1 < MAX_OTHER_RETRIES` → retryable
   - Otherwise → not retryable

5. **If retryable:**
   - Update generation: `status: RETRYING`, `retryCount: attemptsMade + 1` (BullMQ's `job.attemptsMade` is 0-based in the catch block — not yet incremented for the current attempt), `retryReason`, `nextRetryAt: now + delay`, `errorMessage`
   - Publish WebSocket event: `{ type: "retrying", retryCount, retryReason, nextRetryAt, errorMessage }`
   - **Do NOT call `refundCredits()`** — credits stay reserved
   - **Do NOT set `status: FAILED`**
   - Re-throw error → BullMQ applies custom backoff and schedules retry

6. **If not retryable:**
   - Update generation: `status: FAILED`, `errorMessage`
   - Call `refundCredits()`
   - Publish `FAILED` event
   - Throw `UnrecoverableError` → BullMQ won't retry

### `retryReason` Reflects Most Recent Error

The `retryReason` field is updated on each failed attempt to reflect the latest error classification. Values are always `"high_demand"` or `"error"`. This means it can change between attempts (e.g., attempt 1 gets 429 → `"high_demand"`, attempt 2 gets 500 → `"error"`). Retry limits are always checked against `attemptsMade` (BullMQ's cumulative count), not per-reason counts. The UI label will reflect whatever the most recent reason is.

### Extensions Do Not Auto-Retry

Extension jobs (`isExtension: true`) are excluded from auto-retry entirely. They use the existing failure path:
- If some new images were created: mark `COMPLETED` with actual count, partial refund
- If zero new images: mark `FAILED`, full extension refund

This is step 1 in the restructured catch block. The rationale: extensions already have images from the original generation, making partial-success counting ambiguous. The cost of a failed extension is low (user can trigger "Generate More" again).

### Cancellation Check at Job Start

**Before setting `status: PROCESSING`** (this ordering is critical), both processors check:

```typescript
const gen = await prisma.generation.findUnique({ where: { id: generationId } });
if (gen.status === "FAILED") return; // user cancelled while job was delayed
// Only after this check, set status to PROCESSING
await prisma.generation.update({ where: { id: generationId }, data: { status: "PROCESSING" } });
```

This handles the race where a user cancels while the retry is in BullMQ's delayed queue. The check must happen before the `PROCESSING` status write — once `PROCESSING` is set, the generation enters a non-cancellable window until the attempt completes or fails.

### BullMQ `worker.on("failed")` Handler

BullMQ fires the `failed` event on every failed attempt, not just the final failure. The existing handler logs every failure. With retries, this handler fires on retryable failures too. Update the handler to check whether the job will be retried (`job.attemptsMade < job.opts.attempts` and the error is not `UnrecoverableError`) and log accordingly — e.g., "Generation {id} attempt {n} failed, will retry" vs "Generation {id} failed permanently."

## Cancellation API

### `POST /api/generations/[id]/cancel`

1. Authenticate user, verify ownership of the generation
2. Check generation status is `RETRYING` or `QUEUED` (reject if `PROCESSING` — can't cancel an active attempt)
3. Update generation: `status: FAILED`, `nextRetryAt: null`, `errorMessage: "Cancelled by user"`
4. Refund credits — the full `creditCost` on the generation, since auto-retry only applies to non-extension jobs (extensions are excluded from retry per the worker logic), so the refund is always the full reserved amount
5. **Best-effort** remove BullMQ job from queue — `job.remove()` may fail if the job has already moved from delayed to active between the DB write and this call. This is fine — the cancellation check at job start is the authoritative gate, not the removal.
6. Publish `FAILED` event via WebSocket
7. Return 200

## WebSocket & Polling

### New Event Type

Add `RETRYING: "retrying"` to `EVENT_TYPE` in both app and worker constants.

### Retrying Event Payload

Add a RETRYING variant to the `GenerationEvent` discriminated union in `worker/src/lib/progress.ts`:

```typescript
| { type: typeof EVENT_TYPE.RETRYING; retryCount: number; retryReason: string; nextRetryAt: string; errorMessage: string }
```

Published by worker via `publishProgress()`:

```typescript
{
  type: "retrying",
  retryCount: 3,
  retryReason: "high_demand" | "error",
  nextRetryAt: "2026-03-25T12:00:05Z",
  errorMessage: "Rate limited — please try again in a moment"
}
```

Client computes countdown locally from `nextRetryAt`.

### HTTP Polling Fallback

`GET /api/generations/[id]` already returns the full Generation record. With the new fields (`retryCount`, `retryReason`, `nextRetryAt`, status `RETRYING`), the poller picks up retry state automatically — no new endpoint needed.

### Client-Side Changes

**`GenerationProgress` interface** in `use-generation-ws.ts` — add retry fields:

```typescript
retryCount?: number;
retryReason?: "high_demand" | "error";
nextRetryAt?: string; // ISO timestamp
```

Add corresponding state variables in the `useGenerationProgress` hook and set them when a `RETRYING` event is received.

**`useGenerationPoller`:**
- Handle `RETRYING` status: expose `retryCount`, `retryReason`, `nextRetryAt` to UI
- `RETRYING` → `PROCESSING` transition: show normal progress again
- `FAILED` after retries: show final error toast ("Generation failed after N retries — credits refunded")

**`use-generation-ws.ts`:**
- Add a new case for `EVENT_TYPE.RETRYING` in the WebSocket message handler's switch statement. Update status and expose retry fields (`retryCount`, `retryReason`, `nextRetryAt`, `errorMessage`) to subscribers. Without this, `RETRYING` events would be silently dropped by the `default: return` case and only HTTP polling would deliver retry state.

## Queue Tab UI (Editor)

### Retrying State Row

When a generation has status `RETRYING`, the queue row shows:

- **Border color:** amber (high demand) or red (other error)
- **Status dot:** amber or red
- **Status label:** "High demand" or "Retrying"
- **Countdown timer:** "Retrying in 47s" — computed client-side from `nextRetryAt`, ticks down every second via `setInterval`
- **Attempt count:** "Attempt 4" (high demand, no max shown) or "Attempt 2 of 5" (other, max shown)
- **Error message:** latest error from the attempt
- **Generation details:** attribute snapshot, model badge, image count — same as current queue rows
- **Cancel button:** stops retries, refunds credits
- **Elapsed time:** total time since generation was created

When countdown hits 0 and attempt starts (`RETRYING` → `PROCESSING`), the row transitions back to normal progress bar with step counter.

### Clickable Queue Rows

Clicking any queue row (processing or retrying) switches to the history tab and scrolls to the placeholder group for that generation. Uses existing `pendingSlotCounts` to locate the placeholder.

### Completion/Cancellation

- Retries exhausted: row disappears, toast "Generation failed after N retries — credits refunded"
- User cancels: row disappears, toast "Generation cancelled — credits refunded"

## Dashboard UI

### Active Generation Rows

Active generations (status `QUEUED`, `PROCESSING`, `RETRYING`) appear as compact inline rows directly below each project card's thumbnail in the dashboard grid.

Each row shows:
- **Status dot:** green (processing), amber (high demand retry), red (other retry)
- **Description:** "Generating 4 images" / "High demand · Retry 3" / "Retrying · Attempt 2 of 5"
- **Elapsed time:** total since creation
- **Model/image info:** "8 imgs · Detailed"
- **Cancel button:** only for retrying generations

Cards without active generations look identical to today.

### Data Source

Dashboard page query includes active generations per project:

```typescript
generations: {
  where: { status: { in: ["QUEUED", "PROCESSING", "RETRYING"] } },
  orderBy: { createdAt: "desc" },
}
```

This is separate from the existing completed-generation query for thumbnails.

### Client Component for Real-Time Updates

Active generation rows need a client component wrapper. Use a single polling endpoint (`GET /api/generations/active`) that returns all active generations for the user, rather than per-generation polling. Poll interval: `POLL_INTERVAL_MS` (5s). This keeps the dashboard to one request per poll cycle regardless of how many projects have active generations.

### Click Navigation

Clicking an active generation row navigates to `/editor/[projectId]?tab=history&gen=[generationId]`. Editor reads query params, switches to history tab, scrolls to that generation's placeholder group.

## Empty State Toolbar (Editor)

When no images exist and no generation is active (after retries exhausted or user cancelled), the editor center panel shows a compact toolbar instead of just "Generate Now":

- **Model selector:** Quick / Detailed / Premium dropdown
- **Image count selector**
- **Generate button**
- **No** Similar or Inpaint buttons (no image to reference)

This lets users adjust settings before retrying — e.g., switching from Premium to Quick if Premium keeps rate-limiting.

During active generation/retry, the center panel continues to show "Generation in progress — your images will appear below."

## Credit Behavior Summary

| Event | Credits |
|-------|---------|
| Generation created | Reserved (deducted from balance) |
| Attempt fails, will retry | Stay reserved (no refund) |
| Retry succeeds | Stay consumed (normal completion) |
| Max retries exhausted | Refunded |
| User cancels retries | Refunded |
| Extension partial success | Partial refund (existing behavior, unchanged) |

## Stale Generation Sweep & Stalled Job Handling

### Stale Sweep

The existing startup sweep (`sweepStaleGenerations`) marks generations older than 30 minutes in `QUEUED`/`PROCESSING` as failed with refund. Add `RETRYING` handling:

- `RETRYING` generations use a **separate 2-hour threshold** (high-demand retries at 60s intervals can legitimately run for a long time; 99 retries × 60s = ~100 minutes worst case)
- `QUEUED`/`PROCESSING` generations keep the existing 30-minute threshold

### Stalled Job Handler

The existing `worker.on("stalled")` handler calls `refundStaleGeneration()`. Add `RETRYING` to `refundStaleGeneration()`'s early-exit guard — treat it as an active status that should not be refunded via the stalled path. A stalled event during a retry delay is expected (the job is in BullMQ's delayed set, not actively processing), and BullMQ will handle re-scheduling. Without this guard, the stalled handler would double-refund credits for retrying generations.
