# Retry Remaining Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a retryable error occurs mid-generation, retry the job but skip already-generated images. Only generate the remaining ones.

**Architecture:** Two changes per processor: (1) count existing images and start the loop from that offset, (2) reorder the catch block so retryable errors trigger retry even when images exist in DB.

**Tech Stack:** TypeScript, Prisma, BullMQ

---

### Task 1: Generation processor — skip existing + reorder catch

**Files:**
- Modify: `worker/src/processors/generation.processor.ts`

- [ ] **Step 1: Add alreadyGenerated count and adjust loop + totalSteps**

Read the file. Find the generate loop (around line 108: `for (let i = 0; i < imageCount; i++)`). Before the loop, add:

```typescript
    const alreadyGenerated = await prisma.generatedImage.count({ where: { generationId } });
    const remainingImages = imageCount - alreadyGenerated;
```

Update `totalSteps` calculation (around line 22-23). Change from:
```typescript
  const stepsPerImage = model === "quick" ? 2 : 4;
  const totalSteps = (hasRef ? 1 : 0) + imageCount * stepsPerImage;
```
To:
```typescript
  const stepsPerImage = model === "quick" ? 2 : 4;
```

And move `totalSteps` calculation to after the `alreadyGenerated` count, right before the loop:
```typescript
    const totalSteps = (hasRef ? 1 : 0) + remainingImages * stepsPerImage;
    let step = 0;
```

Note: `let step = 0;` must also move down to this location (remove from line 24).

Change the loop to start from `alreadyGenerated`:
```typescript
    for (let i = alreadyGenerated; i < imageCount; i++) {
```

- [ ] **Step 2: Reorder catch block — move error classification before Path 2**

The current catch block order is:
1. Guard (cancelled)
2. Path 1 (extensions)
3. Path 2 (existingImages > 0 → COMPLETED)
4. Path 3/4 (classify error → retry or fail)

Reorder to:
1. Guard (cancelled)
2. Path 1 (extensions)
3. **Classify error** (move the statusCode/isHighDemand/retryable logic up here)
4. **If retryable → set RETRYING, re-throw** (move retry block here, works regardless of existingImages)
5. Path 2 (existingImages > 0 → COMPLETED with partial refund) — only for non-retryable errors
6. Permanent failure (existingImages === 0 → FAILED with full refund)

Concretely, after the extension block (Path 1), the new order is:

```typescript
    // Classify error and determine retryability
    const statusCode = error instanceof Error && "status" in error
      ? (error as Error & { status: number }).status
      : 0;
    const isHighDemand =
      statusCode === 429 || statusCode === 503 ||
      /rate.?limit/i.test(errorMsg) ||
      /too many requests/i.test(errorMsg) ||
      /overloaded/i.test(errorMsg) ||
      /high demand/i.test(errorMsg);
    const retryReason = isHighDemand ? "high_demand" : "error";
    const maxRetries = isHighDemand ? MAX_HIGH_DEMAND_RETRIES : MAX_OTHER_RETRIES;

    const attemptNumber = job.attemptsMade + 1;
    const retryable = attemptNumber < maxRetries;

    if (retryable) {
      const delayIdx = Math.min(job.attemptsMade, RETRY_DELAYS.length - 1);
      const delay = RETRY_DELAYS[delayIdx];
      const nextRetryAt = new Date(Date.now() + delay);

      const retryUpdated = await prisma.generation.updateMany({
        where: { id: generationId, status: { not: GENERATION_STATUS.FAILED } },
        data: {
          status: GENERATION_STATUS.RETRYING,
          retryCount: attemptNumber,
          retryReason,
          nextRetryAt,
          errorMessage: errorMsg,
        },
      });
      if (retryUpdated.count === 0) {
        throw new UnrecoverableError("Cancelled by user");
      }
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.RETRYING,
        retryCount: attemptNumber,
        retryReason,
        nextRetryAt: nextRetryAt.toISOString(),
        errorMessage: errorMsg,
      });
      throw error; // Re-throw — BullMQ schedules retry. Images stay in DB.
    }

    // Non-retryable: check for partial success
    const existingImages = await prisma.generatedImage.count({
      where: { generationId },
    });
    if (existingImages > 0) {
      const perImageCost = CREDIT_COST_PER_IMAGE[job.data.model];
      if (perImageCost === undefined) throw new Error(`Unknown model "${job.data.model}"`);
      const costForCreated = perImageCost * existingImages;
      const partialRefund = Math.max(0, job.data.creditCost - costForCreated);
      const requestedCount = job.data.imageCount ?? existingImages;
      const partialMsg = `${existingImages} of ${requestedCount} images generated. ${partialRefund} credits refunded.`;

      const updated = await prisma.generation.updateMany({
        where: { id: generationId, status: { not: GENERATION_STATUS.FAILED } },
        data: {
          status: GENERATION_STATUS.COMPLETED,
          errorMessage: partialMsg,
          creditCost: costForCreated,
        },
      });
      if (updated.count > 0 && partialRefund > 0) {
        await refundCredits(job.data.userId, generationId, partialRefund);
      }
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.COMPLETED,
        errorMessage: partialMsg,
      });
      throw new UnrecoverableError(errorMsg);
    }

    // No images at all — permanent failure with full refund
    const failUpdated = await prisma.generation.updateMany({
      where: { id: generationId, status: { not: GENERATION_STATUS.FAILED } },
      data: { status: GENERATION_STATUS.FAILED, errorMessage: errorMsg },
    });
    if (failUpdated.count > 0 && job.data.creditCost > 0) {
      await refundCredits(job.data.userId, generationId, job.data.creditCost);
    }
    await publishProgress(job, generationId, {
      type: EVENT_TYPE.FAILED,
      error: errorMsg,
    });
    throw new UnrecoverableError(errorMsg);
```

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add worker/src/processors/generation.processor.ts
git commit -m "feat: retry skips already-generated images, reorder catch for retry-with-partial"
```

---

### Task 2: Inpaint processor — same changes

**Files:**
- Modify: `worker/src/processors/inpaint.processor.ts`

- [ ] **Step 1: Add alreadyGenerated count and adjust loop + totalSteps**

The inpaint processor already interleaves (loop at line ~109). Apply the same pattern:

Before the loop, add:
```typescript
    const alreadyGenerated = await prisma.generatedImage.count({ where: { generationId } });
    const remainingImages = imageCount - alreadyGenerated;
```

Move `totalSteps` calculation to after this count. Change `imageCount * stepsPerImage` to `remainingImages * stepsPerImage`. Move `let step = 0` down too.

Change loop: `for (let i = alreadyGenerated; i < imageCount; i++)`

- [ ] **Step 2: Reorder catch block**

Same reorder as Task 1 — move error classification + retry before Path 2.

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add worker/src/processors/inpaint.processor.ts
git commit -m "feat: inpaint processor retries skip already-generated images"
```

---

### Task 3: CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update auto-retry section**

In the Generation Pipeline section, update the auto-retry description to mention:
- On retry, processors skip already-generated images (count existing in DB, start loop from that offset)
- Retryable errors trigger retry even when partial images exist
- Only non-retryable errors with partial images trigger Path 2 (COMPLETED with errorMessage)

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document retry-remaining-images behavior"
```
