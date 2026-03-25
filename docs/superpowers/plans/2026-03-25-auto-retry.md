# Auto-Retry for Failed Generations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically retry failed generations with smart backoff, show retry status in queue tab and dashboard, and let users cancel retries for credit refunds.

**Architecture:** BullMQ built-in retries with custom backoff strategy (5s→15s→30s→60s cap). Worker classifies errors as `high_demand` (429/503, max 99 retries) or `error` (other, max 5 retries). New `RETRYING` generation status drives UI across editor queue tab and dashboard. Credits stay reserved during retries.

**Tech Stack:** Prisma 7, BullMQ, Next.js 16 App Router, React 19, WebSocket, Tailwind CSS 4, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-25-auto-retry-design.md`

**No test framework** is configured in this project. Verification is manual (type-check + visual inspection).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `RETRYING` to `JobStatus`, add retry fields to `Generation` |
| `worker/prisma/schema.prisma` | Modify | Mirror root schema changes |
| `src/lib/constants.ts` | Modify | Add `RETRYING` to `GENERATION_STATUS`, `EVENT_TYPE`, retry constants |
| `worker/src/lib/constants.ts` | Modify | Mirror app constants |
| `worker/src/lib/progress.ts` | Modify | Add `RETRYING` variant to `GenerationEvent` union |
| `worker/src/lib/credits.ts` | Modify | Add `RETRYING` guard to `refundStaleGeneration` |
| `worker/src/processors/generation.processor.ts` | Modify | Restructure catch block for retry logic |
| `worker/src/processors/inpaint.processor.ts` | Modify | Same catch block restructuring |
| `worker/src/index.ts` | Modify | Add custom backoff, update stalled/failed handlers, update sweep |
| `src/lib/queue.ts` | Modify | Add `getRedisPublisher()` for cancel API WebSocket events |
| `src/app/api/generations/route.ts` | Modify | Add `attempts` + `backoff` to `queue.add()` |
| `src/app/api/generations/[id]/extend/route.ts` | Modify | Add `attempts` + `backoff` to extension `queue.add()` |
| `src/app/api/generations/[id]/cancel/route.ts` | Create | Cancel endpoint — refund + remove BullMQ job + publish WS event |
| `src/lib/credits.ts` | Modify | Add `refundCredits()` function for app-side refunds |
| `src/lib/api/generations.ts` | Modify | Add `cancelGeneration()` client function |
| `src/lib/use-generation-ws.ts` | Modify | Add retry fields to `GenerationProgress`, handle `RETRYING` event |
| `src/components/editor/generation-poller.tsx` | Modify | Add retry fields to `GenerationPollerState`, handle `RETRYING` status |
| `src/components/editor/generation-queue.tsx` | Modify | Add retrying state UI with countdown, cancel button |
| `src/components/editor/use-generation-actions.ts` | Modify | Include `RETRYING` in active generation filters |
| `src/components/editor/editor-center-panel.tsx` | Modify | Add empty-state toolbar with model/imageCount selectors |
| `src/app/dashboard/page.tsx` | Modify | Query active generations, render inline rows |
| `src/components/dashboard/active-generation-row.tsx` | Create | Client component for dashboard generation status with polling |
| `src/components/editor/editor-shell.tsx` | Modify | Read `tab`/`gen` query params, pass to center panel |

---

### Task 1: Schema & Constants

**Files:**
- Modify: `prisma/schema.prisma:103-108` (JobStatus enum), `:130-160` (Generation model)
- Modify: `worker/prisma/schema.prisma` (mirror changes)
- Modify: `src/lib/constants.ts:39-45,162-168`
- Modify: `worker/src/lib/constants.ts:11-16,30-36`

- [ ] **Step 1: Add `RETRYING` to `JobStatus` enum in root Prisma schema**

In `prisma/schema.prisma`, add `RETRYING` after `FAILED`:

```prisma
enum JobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  RETRYING
}
```

- [ ] **Step 2: Add retry fields to Generation model in root schema**

In `prisma/schema.prisma`, add after the `errorMessage` field (line 145):

```prisma
  retryCount            Int       @default(0)
  retryReason           String?
  nextRetryAt           DateTime?
```

- [ ] **Step 3: Mirror both changes in worker schema**

Apply identical changes to `worker/prisma/schema.prisma`.

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add-generation-retry-fields
```

- [ ] **Step 5: Regenerate both Prisma clients**

```bash
npx prisma generate && cd worker && npx prisma generate && cd ..
```

- [ ] **Step 6: Add constants to `src/lib/constants.ts`**

Add `RETRYING` to `GENERATION_STATUS`:

```typescript
export const GENERATION_STATUS = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  RETRYING: "RETRYING",
} as const;
```

Add `RETRYING` to `EVENT_TYPE`:

```typescript
export const EVENT_TYPE = {
  STATUS: "status",
  PROGRESS: "progress",
  COMPLETED: "completed",
  FAILED: "failed",
  RETRYING: "retrying",
} as const;
```

Add retry constants (after `POLL_INTERVAL_MS`):

```typescript
export const RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000] as const;
export const MAX_OTHER_RETRIES = 5;
export const MAX_HIGH_DEMAND_RETRIES = 99;
```

- [ ] **Step 7: Mirror constants in `worker/src/lib/constants.ts`**

Add same `RETRYING` entries to `GENERATION_STATUS` and `EVENT_TYPE`, and add the same `RETRY_DELAYS`, `MAX_OTHER_RETRIES`, `MAX_HIGH_DEMAND_RETRIES` constants.

- [ ] **Step 8: Type-check both packages**

```bash
npx tsc --noEmit && cd worker && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add prisma/ worker/prisma/ src/lib/constants.ts worker/src/lib/constants.ts
git commit -m "feat: add RETRYING status, retry fields, and retry constants"
```

---

### Task 2: Worker Event & Credit Infrastructure

**Files:**
- Modify: `worker/src/lib/progress.ts:6-10`
- Modify: `worker/src/lib/credits.ts:34-94`
- Modify: `worker/src/index.ts:25-42,44-51,53-62,82-105`

- [ ] **Step 1: Add `RETRYING` variant to `GenerationEvent` in `worker/src/lib/progress.ts`**

Replace the `GenerationEvent` type (lines 6-10):

```typescript
export type GenerationEvent =
  | { type: typeof EVENT_TYPE.STATUS; status: GenerationStatus }
  | { type: typeof EVENT_TYPE.PROGRESS; message: string; step: number; totalSteps: number }
  | { type: typeof EVENT_TYPE.COMPLETED }
  | { type: typeof EVENT_TYPE.FAILED; error?: string }
  | { type: typeof EVENT_TYPE.RETRYING; retryCount: number; retryReason: string; nextRetryAt: string; errorMessage: string };
```

- [ ] **Step 2: Add `RETRYING` guard to `refundStaleGeneration` in `worker/src/lib/credits.ts`**

In `refundStaleGeneration`, update the early-exit guard (lines 48-53) to also skip `RETRYING`:

```typescript
  if (
    generation.status === GENERATION_STATUS.COMPLETED ||
    generation.status === GENERATION_STATUS.FAILED ||
    generation.status === GENERATION_STATUS.RETRYING
  ) {
    return false;
  }
```

- [ ] **Step 3: Add custom backoff strategy to Worker in `worker/src/index.ts`**

Import `RETRY_DELAYS` from constants. Update the Worker constructor (lines 25-42) to add `settings.backoffStrategy`:

```typescript
import { RETRY_DELAYS } from "./lib/constants.js";
// (also import UnrecoverableError from bullmq)
import { Job, Worker, UnrecoverableError } from "bullmq";
```

```typescript
const worker = new Worker<GenerationJobData>(
  QUEUE_NAME,
  async (job) => {
    console.log(`[worker] Processing job ${job.id} (${job.name}): generation ${job.data.generationId} (attempt ${job.attemptsMade + 1})`);
    if (job.name === JOB_TYPE.INPAINT) {
      await processInpaint(job as any);
    } else {
      await processGeneration(job);
    }
    console.log(`[worker] Completed job ${job.id}`);
  },
  {
    connection,
    concurrency: 2,
    stalledInterval: 30_000,
    maxStalledCount: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        const idx = Math.min(attemptsMade - 1, RETRY_DELAYS.length - 1);
        return RETRY_DELAYS[idx];
      },
    },
  }
);
```

- [ ] **Step 4: Update `worker.on("failed")` handler**

Replace lines 44-51 to distinguish retryable from permanent failures:

```typescript
worker.on("failed", (job, err) => {
  if (!job) return;
  const willRetry = !(err instanceof UnrecoverableError) && job.attemptsMade < (job.opts.attempts ?? 1);
  if (willRetry) {
    console.log(`[worker] Job ${job.id} attempt ${job.attemptsMade} failed, will retry: ${err.message}`);
  } else {
    console.error(`[worker] Job ${job.id} failed permanently:`, err.message);
    if (process.env.NODE_ENV !== "production") {
      console.error(err.stack);
    }
  }
});
```

- [ ] **Step 5: Update `worker.on("stalled")` handler**

The existing handler (lines 53-62) calls `refundStaleGeneration()` which now has a `RETRYING` guard (Step 2). Add a log for clarity:

```typescript
worker.on("stalled", async (jobId) => {
  console.log(`[worker] Job ${jobId} stalled — checking generation status`);
  const job = await Job.fromId<GenerationJobData>(worker, jobId);
  if (job?.data?.generationId) {
    const refunded = await refundStaleGeneration(job.data.generationId);
    if (refunded) {
      console.log(`[worker] Refunded stale generation ${job.data.generationId}`);
    }
  }
});
```

- [ ] **Step 6: Update `sweepStaleGenerations` to handle `RETRYING`**

Replace lines 82-105. Add a separate 2-hour threshold for `RETRYING`:

```typescript
const STALE_THRESHOLD_MINUTES = 30;
const RETRYING_STALE_THRESHOLD_MINUTES = 120;

async function sweepStaleGenerations(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);
  const retryingCutoff = new Date(Date.now() - RETRYING_STALE_THRESHOLD_MINUTES * 60 * 1000);

  const staleGenerations = await prisma.generation.findMany({
    where: {
      OR: [
        {
          status: { in: [GENERATION_STATUS.QUEUED, GENERATION_STATUS.PROCESSING] },
          createdAt: { lt: cutoff },
        },
        {
          status: GENERATION_STATUS.RETRYING,
          createdAt: { lt: retryingCutoff },
        },
      ],
    },
    select: { id: true },
  });

  if (staleGenerations.length === 0) return;

  console.log(`[worker] Found ${staleGenerations.length} stale generation(s), refunding...`);

  for (const gen of staleGenerations) {
    const generation = await prisma.generation.findUnique({
      where: { id: gen.id },
      select: { status: true, creditCost: true, project: { select: { userId: true } } },
    });
    if (!generation) continue;

    if (generation.status === GENERATION_STATUS.RETRYING) {
      // RETRYING generations are skipped by refundStaleGeneration's guard,
      // so handle them inline: mark FAILED, refund, publish event
      await prisma.generation.update({
        where: { id: gen.id },
        data: { status: GENERATION_STATUS.FAILED, nextRetryAt: null, errorMessage: "Generation timed out after extended retrying" },
      });
      if (generation.creditCost && generation.creditCost > 0) {
        await refundCredits(generation.project.userId, gen.id, generation.creditCost);
      }
      await redisPublisher.publish(
        `generation:${gen.id}`,
        JSON.stringify({ type: EVENT_TYPE.FAILED, error: "Generation timed out" }),
      );
      console.log(`[worker] Swept stale retrying generation ${gen.id}`);
    } else {
      // QUEUED/PROCESSING — use existing refundStaleGeneration
      const refunded = await refundStaleGeneration(gen.id);
      if (refunded) {
        console.log(`[worker] Swept stale generation ${gen.id}`);
      }
    }
  }
}
```

Import `redisPublisher` and `EVENT_TYPE` at the top of the sweep function (they're already imported in the file via `worker/src/lib/credits.ts`).

- [ ] **Step 7: Type-check worker**

```bash
cd worker && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add worker/src/lib/progress.ts worker/src/lib/credits.ts worker/src/index.ts
git commit -m "feat: add retry infrastructure to worker (backoff, events, stale guards)"
```

---

### Task 3: Worker Processor Catch Block Restructuring

**Files:**
- Modify: `worker/src/processors/generation.processor.ts:141-174`
- Modify: `worker/src/processors/inpaint.processor.ts:151-183`

Both processors need the same catch block restructuring. The generation processor is shown in detail; the inpaint processor follows the same pattern.

- [ ] **Step 1: Restructure catch block in `generation.processor.ts`**

Replace the catch block (lines 141-173). Add imports at the top of the file:

```typescript
import { UnrecoverableError } from "bullmq";
import { RETRY_DELAYS, MAX_OTHER_RETRIES, MAX_HIGH_DEMAND_RETRIES } from "../lib/constants.js";
```

New catch block:

```typescript
  } catch (error) {
    const generationId = job.data.generationId;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    // Step 1: Extensions don't auto-retry — use existing failure path
    if (job.data.isExtension) {
      const actualCount = await prisma.generatedImage.count({
        where: { generationId },
      });
      if (actualCount > 0) {
        // Partial success — mark COMPLETED with actual count, partial refund
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: GENERATION_STATUS.COMPLETED,
            imageCount: actualCount,
            creditCost: { decrement: job.data.creditCost },
          },
        });
      } else {
        // Zero new images — mark FAILED, full refund
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: GENERATION_STATUS.FAILED,
            errorMessage: errorMsg,
          },
        });
      }
      if (job.data.creditCost > 0) {
        await refundCredits(job.data.userId, generationId, job.data.creditCost);
      }
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.FAILED,
        error: errorMsg,
      });
      throw new UnrecoverableError(errorMsg); // Prevent BullMQ from retrying extensions
    }

    // Step 2: Check for partial success (some images created before error)
    const existingImages = await prisma.generatedImage.count({
      where: { generationId },
    });
    if (existingImages > 0) {
      // Partial success — mark FAILED, full refund, don't retry (would create duplicates)
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: GENERATION_STATUS.FAILED, errorMessage: errorMsg },
      });
      if (job.data.creditCost > 0) {
        await refundCredits(job.data.userId, generationId, job.data.creditCost);
      }
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.FAILED,
        error: errorMsg,
      });
      throw new UnrecoverableError(errorMsg);
    }

    // Step 3: Classify error
    const isHighDemand = error instanceof Error &&
      ("status" in error && (error as any).status === 429 || (error as any).status === 503) ||
      /rate.?limit/i.test(errorMsg) ||
      /too many requests/i.test(errorMsg) ||
      /overloaded/i.test(errorMsg);
    const retryReason = isHighDemand ? "high_demand" : "error";
    const maxRetries = isHighDemand ? MAX_HIGH_DEMAND_RETRIES : MAX_OTHER_RETRIES;

    // Step 4: Determine if retryable
    const attemptNumber = job.attemptsMade + 1; // 0-based in catch, +1 for display
    const retryable = attemptNumber < maxRetries;

    if (retryable) {
      // Calculate next retry delay
      const delayIdx = Math.min(job.attemptsMade, RETRY_DELAYS.length - 1);
      const delay = RETRY_DELAYS[delayIdx];
      const nextRetryAt = new Date(Date.now() + delay);

      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: GENERATION_STATUS.RETRYING,
          retryCount: attemptNumber,
          retryReason,
          nextRetryAt,
          errorMessage: errorMsg,
        },
      });
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.RETRYING,
        retryCount: attemptNumber,
        retryReason,
        nextRetryAt: nextRetryAt.toISOString(),
        errorMessage: errorMsg,
      });
      // Re-throw — BullMQ applies custom backoff and schedules retry
      // Do NOT refund credits — they stay reserved
      throw error;
    }

    // Not retryable — permanent failure
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: GENERATION_STATUS.FAILED, errorMessage: errorMsg },
    });
    if (job.data.creditCost > 0) {
      await refundCredits(job.data.userId, generationId, job.data.creditCost);
    }
    await publishProgress(job, generationId, {
      type: EVENT_TYPE.FAILED,
      error: errorMsg,
    });
    throw new UnrecoverableError(errorMsg);
  }
```

- [ ] **Step 2: Add cancellation check at top of `generation.processor.ts`**

At the beginning of `processGeneration`, before the existing `PROCESSING` status update (line 35), add:

```typescript
  // Check if user cancelled while this retry was queued
  const genCheck = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { status: true },
  });
  if (genCheck?.status === GENERATION_STATUS.FAILED) {
    console.log(`[generation] Generation ${generationId} was cancelled, skipping`);
    return;
  }
```

- [ ] **Step 3: Apply same changes to `inpaint.processor.ts`**

Apply the identical catch block restructuring to `worker/src/processors/inpaint.processor.ts` (lines 151-183). Also add the cancellation check before the `PROCESSING` status update (line 57). The error variable names and import paths are the same. The only difference is the processor function name (`processInpaint`) and the inpaint-specific job data fields.

- [ ] **Step 4: Type-check worker**

```bash
cd worker && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add worker/src/processors/
git commit -m "feat: restructure worker catch blocks for auto-retry with error classification"
```

---

### Task 4: BullMQ Job Options & Cancel API

**Files:**
- Modify: `src/lib/queue.ts` (add `getRedisPublisher`)
- Modify: `src/lib/credits.ts` (add `refundCredits`)
- Modify: `src/app/api/generations/route.ts:72-81`
- Modify: `src/app/api/generations/[id]/extend/route.ts:86-111`
- Create: `src/app/api/generations/[id]/cancel/route.ts`
- Modify: `src/lib/api/generations.ts` (add `cancelGeneration`)

- [ ] **Step 1: Add `getRedisPublisher` to `src/lib/queue.ts`**

Add a lazy-initialized Redis publisher for WebSocket event publishing from the app:

```typescript
import Redis from "ioredis";

let _publisher: Redis | null = null;

export function getRedisPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(parseRedisConnection());
  }
  return _publisher;
}
```

- [ ] **Step 2: Add retry options to `queue.add` in `src/app/api/generations/route.ts`**

Update the `queue.add` call (lines 72-81) to include retry options:

```typescript
    await getGenerationQueue().add(jobType, {
      generationId,
      projectId: project.id,
      userId: session.user.id,
      imageCount,
      model,
      referenceImageKey: referenceImageKey ?? null,
      flattenedImageDataUrl: flattenedImageDataUrl ?? null,
      creditCost,
    }, {
      attempts: 100,
      backoff: { type: "custom" },
    });
```

- [ ] **Step 3: Add retry options to extension `queue.add` calls**

In `src/app/api/generations/[id]/extend/route.ts`, add the same options to both the inpaint extension (line ~98) and generate extension (line ~110) `queue.add()` calls:

```typescript
    }, {
      attempts: 100,
      backoff: { type: "custom" },
    });
```

Note: Extensions have `isExtension: true` in their job data, so the worker catch block will skip retry logic for them (they fall through to the existing extension failure path). The BullMQ options are set for consistency but the `UnrecoverableError` thrown in the extension path prevents retries.

- [ ] **Step 3: Add `refundCredits` to app-side credits module**

In `src/lib/credits.ts`, add this function (mirrors the worker version):

```typescript
export async function refundCredits(
  userId: string,
  generationId: string,
  creditCost: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: creditCost } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: creditCost,
        balanceAfter: user.creditBalance,
        type: "REFUND",
        description: "Generation cancelled — credits refunded",
        generationId,
      },
    });
  });
}
```

- [ ] **Step 4: Create cancel API route**

Create `src/app/api/generations/[id]/cancel/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGenerationQueue } from "@/lib/queue";
import { GENERATION_STATUS, EVENT_TYPE } from "@/lib/constants";
import { refundCredits } from "@/lib/credits";
import { getRedisPublisher } from "@/lib/queue";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: generationId } = await params;

  const generation = await prisma.generation.findFirst({
    where: {
      id: generationId,
      project: { userId: session.user.id },
    },
    select: {
      id: true,
      status: true,
      creditCost: true,
      project: { select: { userId: true } },
    },
  });

  if (!generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  if (
    generation.status !== GENERATION_STATUS.RETRYING &&
    generation.status !== GENERATION_STATUS.QUEUED
  ) {
    return NextResponse.json(
      { error: "Can only cancel queued or retrying generations" },
      { status: 400 }
    );
  }

  // Mark as failed and clear retry state
  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: GENERATION_STATUS.FAILED,
      nextRetryAt: null,
      errorMessage: "Cancelled by user",
    },
  });

  // Refund credits
  if (generation.creditCost && generation.creditCost > 0) {
    await refundCredits(
      session.user.id,
      generationId,
      generation.creditCost,
    );
  }

  // Best-effort remove BullMQ job (may fail if job already moved to active)
  try {
    const queue = getGenerationQueue();
    const jobs = await queue.getJobs(["delayed", "waiting"]);
    const matchingJob = jobs.find(
      (j) => j.data?.generationId === generationId
    );
    if (matchingJob) {
      await matchingJob.remove();
    }
  } catch {
    // Job removal is best-effort — cancellation check at job start is authoritative
  }

  // Publish FAILED event via Redis so WebSocket clients update immediately
  try {
    const publisher = getRedisPublisher();
    await publisher.publish(
      `generation:${generationId}`,
      JSON.stringify({ type: EVENT_TYPE.FAILED, error: "Cancelled by user" }),
    );
  } catch {
    // WebSocket notification is best-effort — polling will catch it
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Add `cancelGeneration` to client API**

In `src/lib/api/generations.ts`, add:

```typescript
export async function cancelGeneration(generationId: string): Promise<void> {
  await client.post(`/api/generations/${generationId}/cancel`);
}
```

- [ ] **Step 6: Type-check app**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/generations/ src/lib/api/generations.ts src/lib/credits.ts
git commit -m "feat: add retry options to job creation, refundCredits, and cancel API endpoint"
```

---

### Task 5: Client-Side WebSocket & Polling

**Files:**
- Modify: `src/lib/use-generation-ws.ts:5-12,62-87,158-188`
- Modify: `src/components/editor/generation-poller.tsx:16-22,24-75`

- [ ] **Step 1: Add retry fields to `GenerationProgress` in `use-generation-ws.ts`**

Update the interface (lines 6-12):

```typescript
interface GenerationProgress {
  status: GenerationStatus;
  progressMessage: string | null;
  errorMessage: string | null;
  step: number;
  totalSteps: number;
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: string | null;
}
```

- [ ] **Step 2: Add `RETRYING` case to WebSocket message handler**

In the switch statement (lines 68-87), add before the `default` case:

```typescript
          case EVENT_TYPE.RETRYING:
            status = GENERATION_STATUS.RETRYING;
            errorMessage = rest.errorMessage ?? null;
            retryCount = rest.retryCount ?? 0;
            retryReason = rest.retryReason ?? null;
            nextRetryAt = rest.nextRetryAt ?? null;
            break;
```

Add the new variables alongside the existing ones in the `onmessage` handler (around line 62):

```typescript
        let retryCount = 0;
        let retryReason: string | null = null;
        let nextRetryAt: string | null = null;
```

Update the listener call (line 90) to include the new fields:

```typescript
          listener({ generationId, status, progressMessage, errorMessage, step, totalSteps, retryCount, retryReason, nextRetryAt });
```

- [ ] **Step 3: Add retry state variables to `useGenerationProgress` hook**

In the hook (lines 158-188), add state for retry fields:

```typescript
  const [retryCount, setRetryCount] = useState(0);
  const [retryReason, setRetryReason] = useState<string | null>(null);
  const [nextRetryAt, setNextRetryAt] = useState<string | null>(null);
```

Update the `handleEvent` callback to set them:

```typescript
      if (event.retryCount !== undefined) setRetryCount(event.retryCount);
      if (event.retryReason !== undefined) setRetryReason(event.retryReason);
      if (event.nextRetryAt !== undefined) setNextRetryAt(event.nextRetryAt);
```

Don't mark `RETRYING` as completed — only `COMPLETED` and `FAILED` should set `completedRef.current = true`.

Update the return value:

```typescript
  return { status, progressMessage, errorMessage, step, totalSteps, retryCount, retryReason, nextRetryAt };
```

Also update the `Listener` type (line 14) to match the expanded `GenerationProgress`.

- [ ] **Step 4: Add retry fields to `GenerationPollerState` in `generation-poller.tsx`**

Update the interface (lines 16-22):

```typescript
export interface GenerationPollerState {
  status: GenerationStatus;
  progressMessage: string | null;
  errorMessage: string | null;
  step: number;
  totalSteps: number;
  progressPercent: number;
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: string | null;
}
```

- [ ] **Step 5: Handle `RETRYING` in `useGenerationPoller`**

In the hook (lines 24-75), update the destructured WebSocket hook return:

```typescript
  const { status, progressMessage, errorMessage, step, totalSteps, retryCount, retryReason, nextRetryAt } = useGenerationProgress(generationId);
```

In the polling fallback (lines 43-56), add `RETRYING` handling — it's an active state, not a terminal one, so no action needed (just continue polling).

Update the return:

```typescript
  return { status, progressMessage, errorMessage, step, totalSteps, progressPercent, retryCount, retryReason, nextRetryAt };
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/use-generation-ws.ts src/components/editor/generation-poller.tsx
git commit -m "feat: add retry state to WebSocket hook and generation poller"
```

---

### Task 6: Queue Tab UI — Retrying State

**Files:**
- Modify: `src/components/editor/generation-queue.tsx`
- Modify: `src/components/editor/use-generation-actions.ts:64-66,76-79`

- [ ] **Step 1: Include `RETRYING` in active generation filters**

In `src/components/editor/use-generation-actions.ts`, update `pendingGenerations` filter (line 64-66):

```typescript
  const pendingGenerations = projectGenerations.filter(
    (g) => g.status === GENERATION_STATUS.QUEUED || g.status === GENERATION_STATUS.PROCESSING || g.status === GENERATION_STATUS.RETRYING
  );
```

Also update `activeGenerations` (lines 76-79):

```typescript
  const activeGenerations = useMemo(() => {
    const fromProject = projectGenerations.filter(
      (g) => g.status === GENERATION_STATUS.QUEUED || g.status === GENERATION_STATUS.PROCESSING || g.status === GENERATION_STATUS.RETRYING
    );
```

Also update the cleanup effect (lines 88-99) — keep `RETRYING` generations in activeGenerationIds (only remove on `COMPLETED` or `FAILED`). The existing filter already does this since it only removes `COMPLETED`/`FAILED`.

- [ ] **Step 2: Add retrying state to `QueueProgress` in `generation-queue.tsx`**

Add imports at the top:

```typescript
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelGeneration } from "@/lib/api";
import { MAX_OTHER_RETRIES } from "@/lib/constants";
```

Add a `RETRYING` block in `QueueProgress` component (after the PROCESSING block, before COMPLETED):

```typescript
  if (poller.status === GENERATION_STATUS.RETRYING && poller.nextRetryAt) {
    return (
      <RetryingProgress
        retryCount={poller.retryCount}
        retryReason={poller.retryReason}
        nextRetryAt={poller.nextRetryAt}
        errorMessage={poller.errorMessage}
        generationId={generationId}
        onCancel={onCancel}
      />
    );
  }
```

Note: `QueueProgress` needs to receive `generationId` and `onCancel` as props. Update the component signature.

- [ ] **Step 3: Create `RetryingProgress` component in the same file**

```typescript
function RetryingProgress({
  retryCount,
  retryReason,
  nextRetryAt,
  errorMessage,
  generationId,
  onCancel,
}: {
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: string;
  errorMessage: string | null;
  generationId: string;
  onCancel: () => void;
}) {
  const [countdown, setCountdown] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const isHighDemand = retryReason === "high_demand";

  useEffect(() => {
    const target = new Date(nextRetryAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setCountdown(`${remaining}s`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [nextRetryAt]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      await cancelGeneration(generationId);
      onCancel();
    } catch {
      setCancelling(false);
    }
  }, [generationId, onCancel]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className={`size-3.5 shrink-0 ${isHighDemand ? "text-amber-500" : "text-destructive"}`} />
        <span className={`text-xs font-medium ${isHighDemand ? "text-amber-500" : "text-destructive"}`}>
          {isHighDemand ? "High demand" : "Retrying"} · Retrying in {countdown}
        </span>
        <span className="text-xs text-muted-foreground">
          · Attempt {retryCount}{!isHighDemand ? ` of ${MAX_OTHER_RETRIES}` : ""}
        </span>
      </div>
      {errorMessage && (
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs text-destructive hover:text-destructive"
        onClick={handleCancel}
        disabled={cancelling}
      >
        <X className="mr-1 size-3" />
        {cancelling ? "Cancelling..." : "Cancel"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Update `QueueEntry` to style retrying state**

In the `QueueEntry` component, update `isActive` (line 82) to include `RETRYING`:

```typescript
  const isActive = poller.status === GENERATION_STATUS.QUEUED || poller.status === GENERATION_STATUS.PROCESSING || poller.status === GENERATION_STATUS.RETRYING;
```

Add a border color based on retry state. Update the container div (line 85):

```typescript
    <div className={`rounded-lg border px-3 py-2.5 space-y-2 ${
      poller.status === GENERATION_STATUS.RETRYING
        ? poller.retryReason === "high_demand"
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-destructive/30 bg-destructive/5"
        : "bg-muted/30"
    }`}>
```

Pass `generationId` and an `onCancel` callback to `QueueProgress`. The cancel callback should call `onComplete` with `FAILED` status:

```typescript
      <QueueProgress
        poller={poller}
        generationId={generation.id}
        onCancel={() => onComplete(generation.id, GENERATION_STATUS.FAILED)}
      />
```

- [ ] **Step 5: Update `QueueProgress` signature**

```typescript
function QueueProgress({
  poller,
  generationId,
  onCancel,
}: {
  poller: GenerationPollerState;
  generationId: string;
  onCancel: () => void;
}) {
```

- [ ] **Step 6: Make queue rows clickable to switch to history tab**

In `QueueEntry`, wrap the container div with an `onClick` handler that switches to the history tab. The `QueueEntry` needs access to `setActiveTab` — pass it through from `GenerationQueue` props.

Update `GenerationQueueProps`:

```typescript
interface GenerationQueueProps {
  generations: Generation[];
  onComplete: (generationId: string, status: GenerationStatus) => void;
  onSelectGeneration?: (generationId: string) => void;
}
```

In `QueueEntry`, add the click handler on the container div:

```typescript
    <div
      className={`rounded-lg border px-3 py-2.5 space-y-2 cursor-pointer hover:bg-muted/40 transition-colors ${...}`}
      onClick={() => onSelectGeneration?.(generation.id)}
    >
```

In `EditorCenterPanel` (or wherever `GenerationQueue` is rendered), pass `onSelectGeneration` which switches to the history tab (tab 0) and optionally scrolls to the generation's placeholder group:

```typescript
onSelectGeneration={(genId) => {
  setActiveTab(0); // Switch to history tab
}}
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/components/editor/generation-queue.tsx src/components/editor/use-generation-actions.ts
git commit -m "feat: add retrying state UI to queue tab with countdown, cancel, and click-to-history"
```

---

### Task 7: Dashboard Active Generation Rows

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Create: `src/components/dashboard/active-generation-row.tsx`

- [ ] **Step 1: Update dashboard query to include active generations**

In `src/app/dashboard/page.tsx`, update the Prisma query (lines 26-37) to also include active generations:

```typescript
  const projects = await prisma.coverProject.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      generations: {
        where: { status: GENERATION_STATUS.COMPLETED },
        include: { images: { where: { selected: true }, take: 1 } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Separate query for active generations (avoids complicating the thumbnail query)
  const activeGenerations = await prisma.generation.findMany({
    where: {
      project: { userId: session.user.id },
      status: { in: [GENERATION_STATUS.QUEUED, GENERATION_STATUS.PROCESSING, GENERATION_STATUS.RETRYING] },
    },
    select: {
      id: true,
      projectId: true,
      status: true,
      imageCount: true,
      model: true,
      retryCount: true,
      retryReason: true,
      nextRetryAt: true,
      errorMessage: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Group active gens by project
  const activeByProject = new Map<string, typeof activeGenerations>();
  for (const gen of activeGenerations) {
    const list = activeByProject.get(gen.projectId) ?? [];
    list.push(gen);
    activeByProject.set(gen.projectId, list);
  }
```

- [ ] **Step 2: Render active generation rows under each card**

Update the project card rendering (around line 93, after the gradient overlay div closes). Import `ActiveGenerationRow`:

```typescript
import { ActiveGenerationRows } from "@/components/dashboard/active-generation-row";
```

After the `</Link>` (line 94), before the dropdown menu div:

```typescript
                {activeByProject.has(project.id) && (
                  <ActiveGenerationRows
                    projectId={project.id}
                    initialGenerations={activeByProject.get(project.id)!}
                  />
                )}
```

- [ ] **Step 3: Create `ActiveGenerationRow` client component**

Create `src/components/dashboard/active-generation-row.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { GENERATION_STATUS, POLL_INTERVAL_MS } from "@/lib/constants";
import { cancelGeneration } from "@/lib/api";
import { getModelLabel } from "@/components/editor/generation-helpers";
import { formatRelativeTime } from "@/components/editor/generation-helpers";

interface ActiveGeneration {
  id: string;
  projectId: string;
  status: string;
  imageCount: number;
  model: string | null;
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: Date | string | null;
  errorMessage: string | null;
  createdAt: Date | string;
}

interface ActiveGenerationRowsProps {
  projectId: string;
  initialGenerations: ActiveGeneration[];
}

export function ActiveGenerationRows({ projectId, initialGenerations }: ActiveGenerationRowsProps) {
  const router = useRouter();
  const [generations, setGenerations] = useState(initialGenerations);

  // Poll for updates
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/generations/active?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setGenerations(data.generations);
          if (data.generations.length === 0) {
            router.refresh();
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [projectId, router]);

  if (generations.length === 0) return null;

  return (
    <div className="border-t">
      {generations.map((gen) => (
        <DashboardGenRow key={gen.id} generation={gen} projectId={projectId} onCancelled={() => {
          setGenerations((prev) => prev.filter((g) => g.id !== gen.id));
          router.refresh();
        }} />
      ))}
    </div>
  );
}

function DashboardGenRow({
  generation,
  projectId,
  onCancelled,
}: {
  generation: ActiveGeneration;
  projectId: string;
  onCancelled: () => void;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [countdown, setCountdown] = useState("");
  const isRetrying = generation.status === GENERATION_STATUS.RETRYING;
  const isHighDemand = generation.retryReason === "high_demand";

  // Countdown timer for retrying
  useEffect(() => {
    if (!isRetrying || !generation.nextRetryAt) return;
    const target = new Date(generation.nextRetryAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setCountdown(`${remaining}s`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRetrying, generation.nextRetryAt]);

  const handleCancel = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelling(true);
    try {
      await cancelGeneration(generation.id);
      toast.success("Generation cancelled — credits refunded");
      onCancelled();
    } catch {
      setCancelling(false);
      toast.error("Failed to cancel generation");
    }
  }, [generation.id, onCancelled]);

  const handleClick = () => {
    router.push(`/editor/${projectId}?tab=history&gen=${generation.id}`);
  };

  const date = typeof generation.createdAt === "string"
    ? new Date(generation.createdAt)
    : generation.createdAt;

  const modelLabel = getModelLabel(generation.model);

  // Status indicator
  let dotColor = "bg-primary";
  let label = `Generating ${generation.imageCount} images`;
  if (isRetrying) {
    dotColor = isHighDemand ? "bg-amber-500" : "bg-destructive";
    label = isHighDemand
      ? `High demand · Retry ${generation.retryCount}`
      : `Retrying · Attempt ${generation.retryCount}`;
  }

  return (
    <div
      className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      onClick={handleClick}
    >
      <div className={`size-2 shrink-0 rounded-full ${dotColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className={isRetrying ? (isHighDemand ? "text-amber-500" : "text-destructive") : "text-muted-foreground"}>
            {label}
          </span>
          {isRetrying && countdown && (
            <span className="text-muted-foreground">· {countdown}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{generation.imageCount} imgs{modelLabel ? ` · ${modelLabel}` : ""}</span>
          <span>· {formatRelativeTime(date)}</span>
        </div>
      </div>
      {!isRetrying && (
        <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
      )}
      {isRetrying && (
        <button
          className="shrink-0 rounded border border-destructive/40 px-1.5 py-0.5 text-[9px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
          onClick={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? "..." : "Cancel"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create active generations API endpoint**

Create `src/app/api/generations/active/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GENERATION_STATUS } from "@/lib/constants";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const where: Record<string, unknown> = {
    project: { userId: session.user.id },
    status: { in: [GENERATION_STATUS.QUEUED, GENERATION_STATUS.PROCESSING, GENERATION_STATUS.RETRYING] },
  };
  if (projectId) {
    where.projectId = projectId;
  }

  const generations = await prisma.generation.findMany({
    where,
    select: {
      id: true,
      projectId: true,
      status: true,
      imageCount: true,
      model: true,
      retryCount: true,
      retryReason: true,
      nextRetryAt: true,
      errorMessage: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ generations });
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/dashboard/active-generation-row.tsx src/app/api/generations/active/
git commit -m "feat: show active generations on dashboard with polling and cancel"
```

---

### Task 8: Empty State Toolbar & Editor Navigation

**Files:**
- Modify: `src/components/editor/editor-center-panel.tsx:290-301`
- Modify: `src/components/editor/editor-shell.tsx` (query params)

- [ ] **Step 1: Replace empty state with toolbar in `editor-center-panel.tsx`**

The empty state (lines 290-301) currently shows an icon and "Generate Now" button. Replace with a toolbar that includes model selector and image count.

Add the toolbar props to `EditorCenterPanel` — it needs `model`, `setModel`, `imageCount`, `setImageCount` from `genActions`. These are already passed through `EditorShell`. Add them to the component's props interface.

Replace the empty state block:

```tsx
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <ImageIcon className="size-12 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">
                No generated images yet
              </p>
              <div className="flex items-center gap-3">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(imageCount)} onValueChange={(v) => setImageCount(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 4, 8].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? "image" : "images"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="default" size="sm" onClick={handleRegenerate}>
                  <RefreshCw className="mr-2 size-3.5" />
                  Generate
                </Button>
              </div>
            </div>
          )}
```

Add imports for `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `@/components/ui/select` and `AI_MODELS` from `@/lib/constants`.

- [ ] **Step 2: Wire model/imageCount props through from EditorShell**

In `editor-shell.tsx`, ensure `model`, `setModel`, `imageCount`, `setImageCount` from `genActions` are passed to `EditorCenterPanel`. Check the current props being passed and add any missing ones.

- [ ] **Step 3: Handle `tab` and `gen` query params in EditorShell**

In `editor-shell.tsx`, add query param reading for navigation from dashboard:

```typescript
import { useSearchParams } from "next/navigation";
```

Inside the component, after the existing state initialization:

```typescript
  const searchParams = useSearchParams();

  // Handle navigation from dashboard — auto-switch tab and scroll to generation
  useEffect(() => {
    const tab = searchParams.get("tab");
    const genId = searchParams.get("gen");
    if (tab === "history") {
      genActions.setActiveTab(0); // 0 = history tab
    } else if (tab === "queue") {
      genActions.setActiveTab(1); // 1 = queue tab
    }
    // TODO: scroll to generation group if genId is provided
    // This can be implemented later with a ref on GenerationGroup
  }, []); // Run once on mount
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/editor-center-panel.tsx src/components/editor/editor-shell.tsx
git commit -m "feat: add model/imageCount toolbar to empty state, handle tab query params"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Type-check both packages**

```bash
npx tsc --noEmit && cd worker && npx tsc --noEmit
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

- [ ] **Step 3: Manual verification checklist**

1. Start dev servers: `npm run dev` and `npm run dev:worker`
2. Create a generation — verify it appears in queue tab with normal progress
3. In worker, temporarily return a 429 error to simulate rate limiting — verify:
   - Queue tab shows amber "High demand" with countdown timer
   - Retry count increments
   - Cancel button works and refunds credits
4. Simulate a non-429 error — verify:
   - Queue tab shows red "Retrying" with "Attempt N of 5"
   - After 5 retries, generation fails with credit refund toast
5. Check dashboard — verify active generation rows appear under project cards
6. Click a dashboard generation row — verify navigation to editor with correct tab
7. Check empty state — verify model selector and image count appear when no images exist
8. Check that extensions still work correctly (no retry on extension failures)

- [ ] **Step 4: Commit any lint fixes**

```bash
git add -u && git commit -m "fix: lint issues from auto-retry implementation"
```
