# Surgical Bake via Inpaint Design

## Goal

Route "Bake Layers" through the inpaint pipeline with an auto-generated mask from layer bounding boxes, so Gemini only edits the regions where text/image layers sit — preserving the rest of the image exactly. Also add aspect-ratio padding to the inpaint processor to prevent cropping from cutting into edited regions.

## Current Behavior (broken)

Bake uses `GENERATE_FROM_REFERENCE` → `generateSingleImage()`. Even with the "preserve image exactly" prompt, Gemini regenerates the entire image because the generation pipeline is designed for creating new images, not editing existing ones. The result is a similar-looking but completely redrawn cover.

## Design

### 1. Auto-generate mask from layer bounding boxes

On the client, before submitting a bake job, generate a mask image from visible canvas layers:

- Create an offscreen canvas at KDP resolution (1600×2560)
- Fill with black (unedited regions)
- For each visible text/image layer, draw a white filled rectangle at its bounding box (with some padding, ~20px, for blending room)
- Export as a PNG data URL

`CanvasNode` has `x`, `y`, `width` for both text and image nodes. Text nodes don't store `height` — get it from the Konva node's `getClientRect()` or compute from `fontSize` + line count. Image nodes have explicit `height`.

Coordinates are in canvas space (400×640), scale by `KDP.width / CANVAS_WIDTH` (4×) to get KDP-resolution mask.

### 2. Route bake through inpaint API

Currently bake calls `handleGenerateSimilar(prompt, true)` which creates a `GENERATE_FROM_REFERENCE` job. Change to call the inpaint API instead:

- `handleSubmitBake` in `inpaint-toolbar.tsx` calls `createInpaint()` directly (not `onGenerateSimilar`)
- Passes: `imageId` (selected image), `maskDataUrl` (auto-generated mask), `prompt` (bake instructions), `model`, `flattenedImageDataUrl` (canvas with text rendered)
- The inpaint API route creates a `JOB_TYPE.INPAINT` job as usual

The bake prompt changes from "incorporate these elements" to "integrate/blend the text that is already rendered in the masked regions into the artwork naturally" — since the flattened image already has text rendered, the AI just needs to blend it.

### 3. Send mask to Gemini

`inpaintImage()` in `gemini.service.ts` has a `maskBuffer` parameter that is currently unused. Start sending it as a second `inlineData` part when present:

```
parts: [
  { inlineData: { mimeType: "image/png", data: sourceImage } },
  { inlineData: { mimeType: "image/png", data: maskImage } },   // NEW
  { text: "The second image is a mask. Edit ONLY the white regions..." }
]
```

For regular inpaint (user-painted mask), the mask is already available. For bake, it's the auto-generated mask. When no mask is provided, behavior is unchanged (prompt-only editing).

### 4. Add padding to inpaint processor

Move `padToAspectRatio()` from generation processor to inpaint processor. Both regular inpaint and bake benefit — any edit near edges risks being cropped.

In `inpaint.processor.ts`, after downloading the source image (and flattened image if present), pad to the generation aspect ratio before sending to Gemini. The existing `cropToKDP` step after generation removes only the padding.

Also pad the mask image to match (extend mask with black = "don't edit the padding").

### 5. Remove padding from generation processor

Remove the `padToAspectRatio` call from `generation.processor.ts`. Generate and Similar don't need it — they create new artwork where 10% crop loss is acceptable.

### 6. Bake prompt adjustments

The system prompt's `buildTextPolicy` and reference clause remain as-is for regular generation. For bake-via-inpaint, the prompt is built client-side (in `buildBakeLayersPrompt`) and sent directly through the inpaint API. Adjust the bake prompt to reflect that text is already rendered:

- **Stylized**: "The text in the masked regions has been placed onto the image. Integrate it into the artwork with creative, genre-appropriate effects — embossing, glow, texture, shadows. Make it look like a professionally designed cover. Do not modify anything outside the masked regions."
- **Clean**: "The text in the masked regions has been placed onto the image. Blend it cleanly into the composition — add subtle shadows or contrast adjustments for legibility. Do not apply decorative effects. Do not modify anything outside the masked regions."

### 7. Inpaint toolbar changes

`handleSubmitBake` currently calls `onGenerateSimilar(bakePrompt, true)`. Change to:

1. Generate mask from visible layer bounding boxes
2. Flatten canvas to data URL (already done when `includeLayers=true`)
3. Call `createInpaint()` with the auto-generated mask and flattened image
4. Set active generation IDs, open History tab, refresh credits (same post-submit flow)

The `onGenerateSimilar` prop is no longer used for bake — it still exists for the Similar flow.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/editor/inpaint-toolbar.tsx` | Auto-generate mask from layer bounds, call `createInpaint()` for bake instead of `onGenerateSimilar()` |
| `src/components/editor/use-inpaint-state.ts` | Export `flattenCanvasToDataUrl` and potentially a new `generateLayerMask` utility |
| `worker/src/services/gemini.service.ts` | Send `maskBuffer` as second `inlineData` part when present |
| `worker/src/processors/inpaint.processor.ts` | Add `padToAspectRatio` on source image + mask before Gemini call |
| `worker/src/processors/generation.processor.ts` | Remove `padToAspectRatio` call and import |
| `worker/src/lib/prompt.ts` | No changes needed — bake prompt is built client-side for inpaint |
