# Remove HTTP Polling — WebSocket-Only Real-Time Updates

**Date:** 2026-03-26

## Problem

The app uses HTTP polling as a fallback alongside WebSockets for generation progress. This creates scaling issues:
- Dashboard renders `ActiveGenerationRows` per project, each running its own 5s poll to `GET /api/generations/active?projectId=X`. Ten active projects = 120 requests/min.
- Editor runs a separate 5s poll per active generation via `useGenerationPoller`, redundant with the WebSocket subscription.
- Dashboard has no WebSocket integration at all — purely polling-based.

## Solution

Remove all generation-related HTTP polling. Extend the existing WebSocket singleton to support project-level subscriptions for the dashboard. Add one-shot HTTP fetches on mount and reconnect to replace polling's reliability role.

## Decisions

- **Billing polling stays** — the 2s post-checkout poll in `billing-tab.tsx` is short-lived (max 60s), rare, and serves a different purpose (webhook detection). Not worth adding a billing WebSocket channel.
- **No heartbeat/ping** — existing reconnect logic with exponential backoff (1s→10s cap) is sufficient.
- **SSE route removed** — `src/app/api/generations/[id]/events/route.ts` is unused by any client code. Removing dead code.
- **Project channel is status-only** — publishes on status transitions only, not granular progress ticks. Keeps dashboard traffic minimal.
- **One-shot fetch on mount + reconnect** — replaces polling's reliability role. Not polling — single fetch triggered by specific events.

## WebSocket Protocol Changes

### New message types

Added to `WS_MESSAGE_TYPE` in both `src/lib/constants.ts` and `worker/src/lib/constants.ts`:
- `SUBSCRIBE_PROJECT` — subscribe to all generation events for a project
- `UNSUBSCRIBE_PROJECT` — unsubscribe from project channel

### New Redis channel pattern

- `project:{projectId}` — carries generation status changes

### Client → Server messages

```ts
// Existing
{ type: "SUBSCRIBE", generationId: string }
{ type: "UNSUBSCRIBE", generationId: string }

// New
{ type: "SUBSCRIBE_PROJECT", projectId: string }
{ type: "UNSUBSCRIBE_PROJECT", projectId: string }
```

### Server → Client messages

Generation channel (unchanged):
```ts
{ generationId: string, type: EventType, ...progressFields }
```

Project channel (new):
```ts
{
  projectId: string,
  generationId: string,
  type: EventType,
  status: GenerationStatus,
  imageCount?: number,
  errorMessage?: string | null,
  retryCount?: number,
  retryReason?: string | null,
  nextRetryAt?: string | null,
}
```

## Worker Dual-Publish

When the processor updates a generation's status, it publishes to both channels:

1. `generation:{generationId}` — every progress event (existing behavior, unchanged)
2. `project:{projectId}` — only on status transitions:
   - QUEUED → PROCESSING
   - PROCESSING → COMPLETED
   - PROCESSING → FAILED
   - PROCESSING → RETRYING (with retry fields)
   - RETRYING → PROCESSING (retry attempt starting)
   - Any terminal state (COMPLETED, FAILED)

The project channel does NOT fire on granular progress ticks ("Generating image 3 of 8"). Only status transitions and completion.

`publishProgress()` in `worker/src/lib/progress.ts` changes signature to `(job, generationId, projectId, event)` — `projectId` is required. All ~12 existing call sites in `generation.processor.ts` already have access to `projectId` via job data. Status-bearing events trigger a second `redis.publish()` to the project channel.

### Cancel API dual-publish

The cancel API route (`src/app/api/generations/[id]/cancel/route.ts`) currently publishes a `FAILED` event to `generation:{id}` only. It must also publish to `project:{projectId}` so dashboard subscribers learn about cancellations. The route's Prisma select needs `projectId` added.

## WebSocket Singleton Changes

### `use-generation-ws.ts`

The singleton manager expands to track two subscription types:

```ts
// Existing
subscriptions: Set<string>           // generation IDs
listeners: Map<string, Set<Listener>>

// New
projectSubscriptions: Set<string>           // project IDs
projectListeners: Map<string, Set<ProjectListener>>
```

Message routing checks for `projectId` field to dispatch to the correct listener map. The worker's `subscriber.on("message")` handler in `websocket.ts` must distinguish between `generation:` and `project:` channel prefixes and inject the correct identifier field (`generationId` or `projectId`) before relaying to the client.

### New hook: `useProjectGenerations(projectId)`

Returns an array of active generations for the project. Manages:
- Subscribe to `project:{projectId}` on mount
- Unsubscribe on unmount
- One-shot fetch of `GET /api/generations/active?projectId=X` on mount for initial state
- One-shot re-fetch on WebSocket reconnect to sync missed events
- Updates the array when project channel events arrive (status change, new generation, completion/removal)

### Modified hook: `useGenerationProgress(generationId)`

- Remove `syncState()` method (no longer needed — polling doesn't call it)
- Add one-shot fetch of `GET /api/generations/[id]` on mount for initial state
- Add one-shot re-fetch on WebSocket reconnect
- Accept optional `onComplete(status, errorMessage?)` callback — fires when a terminal status (COMPLETED, FAILED) is received via WebSocket or mount/reconnect fetch
- Otherwise unchanged

## Behavioral Migration from Poller

The deleted `useGenerationPoller` handles three side effects beyond polling that must be relocated:

1. **Toast notifications** on terminal states (`toast.success`, `toast.error`, `toast.warning`) — move into `generation-queue.tsx`'s `QueueEntry` component via the `onComplete` callback on `useGenerationProgress`
2. **`router.refresh()`** on completion — move into `generation-queue.tsx`'s `onComplete` handler (editor) and into `useProjectGenerations`'s completion detection (dashboard)
3. **`onComplete` callback** — `useGenerationProgress` gains an `onComplete` option; `generation-queue.tsx` passes it to trigger parent cleanup (remove from active list, refresh images)

Dashboard: `useProjectGenerations` calls `router.refresh()` when a generation transitions to a terminal state, replacing the current behavior where polling detects zero active generations and refreshes.

## Reliability Without Polling

### On mount (initialization)
When a component first subscribes, it does a single HTTP fetch to get current state, then relies on WebSocket for all updates.

### On reconnect (gap recovery)
When the WebSocket reconnects after a disconnection (detected via `onopen` after a prior `onclose`), all active subscriptions trigger a one-shot HTTP fetch to sync any events missed during the gap.

- Generation subscriptions: fetch `GET /api/generations/[id]` once per active subscription
- Project subscriptions: fetch `GET /api/generations/active?projectId=X` once per active subscription

This is NOT polling — it's a single fetch triggered by a specific event (reconnection).

### On initial connection
No sync fetch needed — mount already fetched initial state.

## Files to Delete

- `src/components/editor/generation-poller.tsx` — entire file, 5s polling hook
- `src/app/api/generations/[id]/events/route.ts` — unused SSE fallback route

## Files to Modify

- `src/lib/constants.ts` — add `SUBSCRIBE_PROJECT`, `UNSUBSCRIBE_PROJECT` to `WS_MESSAGE_TYPE`
- `worker/src/lib/constants.ts` — same additions
- `src/lib/use-generation-ws.ts` — add project subscriptions, project listeners, reconnect-sync logic, new `useProjectGenerations` hook, modify `useGenerationProgress` to add mount/reconnect fetch
- `worker/src/lib/websocket.ts` — handle `SUBSCRIBE_PROJECT`/`UNSUBSCRIBE_PROJECT` messages, subscribe to `project:{projectId}` Redis channels
- `worker/src/lib/progress.ts` — add `projectId` parameter, dual-publish to project channel on status transitions
- `worker/src/processors/generation.processor.ts` — pass `projectId` to `publishProgress()` calls
- `src/components/editor/generation-queue.tsx` — remove `useGenerationPoller` usage, rely on `useGenerationProgress` only
- `src/components/dashboard/active-generation-row.tsx` — replace polling with `useProjectGenerations` hook
- `src/components/editor/editor-shell.tsx` — remove any `GenerationPoller` component usage
- `src/app/api/generations/[id]/cancel/route.ts` — add dual-publish to `project:{projectId}` channel, add `projectId` to Prisma select
- `CLAUDE.md` — update references to `useGenerationPoller` and polling fallback descriptions

## Cleanup

- Remove `POLL_INTERVAL_MS` from `src/lib/constants.ts` (no consumers after poller deletion)
- Rename `GenerationPollData` type in `src/lib/api/generations.ts` to `GenerationStatusData` (no longer poll-specific)

## Files to Create

None — all changes are modifications to existing files or deletions.
