# Interleaved Generation Pipeline Design

## Goal

Restructure the generation processor to generate, process, and save each image to DB before starting the next one. This ensures that if an API call fails mid-sequence, previously generated images are persisted and the partial failure UX kicks in properly.

## Current Behavior (broken)

`generation.processor.ts` calls `dispatchGenerate()` → `generateImages()` which loops through all N images, collecting `Buffer[]` in memory. Only after ALL images are generated does the processor loop through to upscale/crop/upload/save each one. If image 5 of 8 fails, images 1-4 are thrown away (never saved to DB), the API costs for those 4 calls are wasted, and Path 2 (partial success) never triggers because `existingImages = 0`.

Note: The inpaint processor already interleaves correctly — it calls `dispatchInpaint()` (single image) inside its per-image loop.

## Design

### `gemini.service.ts`

Remove `generateImages()` and its related `GeminiGenerateParams` interface. Replace with `generateSingleImage()`:

```typescript
export interface GenerateSingleImageParams {
  prompt: string;
  referenceImage?: Buffer;
  modelId: string;
  config?: GeminiImageConfig;
}

export async function generateSingleImage(params: GenerateSingleImageParams): Promise<Buffer>
```

Same API call logic as the current loop body, but returns a single `Buffer` instead of `Buffer[]`.

### `generation.processor.ts`

Remove `dispatchGenerate()`. Merge the generation and upload into a single per-image loop:

```
for each image (i = 0..imageCount-1):
  1. Generate single image via Gemini API
  2. Quick: read dimensions via Sharp
     Others: upscale + crop to KDP
  3. Upload to R2
  4. Save GeneratedImage row to DB
  5. Report progress
```

The prompt building, reference image download, and generation metadata save stay before the loop (unchanged). Only the generate→upload flow changes.

**Progress step count**: Currently `totalSteps = (hasRef ? 1 : 0) + 1 + imageCount * stepsPerImage`. The `+ 1` was for the single "Generating N images..." step. With interleaving, generation is part of the per-image loop. New calculation:

- Quick: generate + upload = 2 steps per image
- Others: generate + upscale + crop + upload = 4 steps per image
- `totalSteps = (hasRef ? 1 : 0) + imageCount * stepsPerImage`

Where `stepsPerImage` changes from `1/3` to `2/4`.

### Error handling

No changes to the catch block. With interleaving, when image 5 fails:
- Images 1-4 are already in DB (`GeneratedImage` rows exist)
- `existingImages = 4 > 0` → Path 2 triggers
- Sets `COMPLETED` with `errorMessage`, partial refund
- Frontend shows 4 images + 4 amber failed slots

### `inpaint.processor.ts`

No changes — already interleaved.

## Files to Modify

| File | Change |
|------|--------|
| `worker/src/services/gemini.service.ts` | Remove `generateImages()` + `GeminiGenerateParams`. Add `generateSingleImage()` + `GenerateSingleImageParams`. |
| `worker/src/processors/generation.processor.ts` | Remove `dispatchGenerate()`. Import `generateSingleImage`. Merge generate + upload into single per-image loop. Update `stepsPerImage` and `totalSteps`. |
| `CLAUDE.md` | Remove any reference to batch generation. |

## Out of Scope

- Inpaint processor (already interleaved)
- Frontend changes (none needed)
- Cancel during PROCESSING (stays rejected)
