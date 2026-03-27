# Retry Remaining Images Design

## Goal

When image N of M fails with a retryable error (429/503), retry the job. On retry, skip already-generated images and only generate the remaining ones.

## Current Behavior (broken)

The catch block checks paths in this order:
1. Guard (cancelled)
2. Path 1 (extensions → UnrecoverableError)
3. Path 2 (existingImages > 0 → COMPLETED with partial refund → UnrecoverableError)
4. Path 3/4 (classify error → retry or permanent failure)

Path 2 fires before the retry logic whenever images exist, so **retryable errors with partial images always result in immediate partial completion** — no retry attempt. The user gets 4 of 8 images even though a retry might have succeeded.

## Design

### 1. Reorder catch block: classify error BEFORE Path 2

Move error classification (Path 3/4) to run right after the extension check (Path 1). If the error is retryable and within retry limits, set RETRYING and re-throw — regardless of whether images exist in DB. Only fall through to Path 2 (partial success) for non-retryable errors.

New catch block order:
1. Guard (cancelled)
2. Path 1 (extensions → no retry)
3. **Classify error** — is it retryable?
4. **If retryable + within limits** → set RETRYING, re-throw (images stay in DB for next attempt)
5. **If not retryable + existingImages > 0** → COMPLETED with errorMessage + partial refund (old Path 2)
6. **If not retryable + existingImages === 0** → FAILED with full refund (old Path 4)

### 2. Skip already-generated images on retry

At the start of the generate loop in both processors, count existing images and start from that index:

```typescript
const alreadyGenerated = await prisma.generatedImage.count({ where: { generationId } });
for (let i = alreadyGenerated; i < imageCount; i++) {
  // generate only remaining images
}
```

On first attempt: `alreadyGenerated = 0`, generates all.
On retry: `alreadyGenerated = 4`, generates images 5-8 only.

### 3. Adjust totalSteps on retry

The progress step count should reflect remaining work, not total work:

```typescript
const alreadyGenerated = await prisma.generatedImage.count({ where: { generationId } });
const remainingImages = imageCount - alreadyGenerated;
const totalSteps = (hasRef && alreadyGenerated === 0 ? 1 : 0) + remainingImages * stepsPerImage;
```

Reference download is also skipped on retry (refBuffer already handled — actually no, each attempt starts fresh so reference needs re-downloading. Keep reference step unconditional if `hasRef`).

Actually simpler: `totalSteps = (hasRef ? 1 : 0) + remainingImages * stepsPerImage`.

### 4. Inpaint processor

Same changes — the inpaint processor already interleaves, just needs the skip-existing logic and reordered catch block.

## Files to Modify

| File | Change |
|------|--------|
| `worker/src/processors/generation.processor.ts` | Skip existing images in loop, reorder catch block |
| `worker/src/processors/inpaint.processor.ts` | Same changes |
| `CLAUDE.md` | Document retry-remaining behavior |
