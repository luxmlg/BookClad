# Surgical Bake via Inpaint Design

## Goal

Route "Bake Layers" through the inpaint pipeline with an auto-generated mask from layer bounding boxes, so Gemini only edits the regions where text/image layers sit — preserving the rest of the image exactly. Also add aspect-ratio padding to the inpaint processor to prevent cropping from cutting into edited regions.

## Current Behavior (broken)

Bake uses `GENERATE_FROM_REFERENCE` → `generateSingleImage()`. Even with the "preserve image exactly" prompt, Gemini regenerates the entire image because the generation pipeline is designed for creating new images, not editing existing ones. The result is a similar-looking but completely redrawn cover.

## Design

### 1. Auto-generate mask from layer bounding boxes

Add a `generateLayerMask()` function in `use-inpaint-state.ts` (which has `stageRef` access). It uses Konva's `getClientRect()` on each visible node to get axis-aligned bounding rects (handles rotation correctly), then draws them as white rectangles on a black offscreen canvas at KDP resolution.

Steps:
- Get stage via `stageRef.current`
- For each visible text/image node, call `node.getClientRect()` → returns `{ x, y, width, height }` in canvas space, axis-aligned (accounts for rotation)
- Create an offscreen HTML canvas at KDP resolution (1600×2560)
- Fill with black
- For each bounding rect, scale by `KDP.width / CANVAS_WIDTH` (4×) and draw a white filled rectangle with 80px padding (20px canvas-space × 4× scale) for blending room
- Export as PNG data URL

Expose `generateLayerMask` via the inpaint ref so `inpaint-toolbar.tsx` can call it.

### 2. Route bake through inpaint API

Add a new `handleBakeSubmit` function in `use-inpaint-state.ts` (alongside existing `handleInpaintSubmit`). This function:
- Generates the layer mask via `generateLayerMask()`
- Flattens the canvas via `flattenCanvasToDataUrl()`
- Calls `createInpaint()` with: `imageId` (selected image), `maskDataUrl` (auto-generated mask), `prompt` (bake instructions), `model`, `flattenedImageDataUrl`
- Handles post-submit state: `setActiveGenerationIds`, `setPendingSlotCounts`, `setActiveTab(0)`, `setPanelOpen(true)`, `refreshCredits()`, `router.refresh()`

`handleSubmitBake` in `inpaint-toolbar.tsx` calls `onBakeSubmit(prompt)` (a new prop from the hook) instead of `onGenerateSimilar(bakePrompt, true)`.

Bake produces 1 image per job (same as inpaint). Remove the image count slider from bake mode in the toolbar.

### 3. Send mask to Gemini

`inpaintImage()` in `gemini.service.ts` has a `maskBuffer` parameter that is currently unused. When present, send it as a second `inlineData` part:

```
parts: [
  { inlineData: { mimeType: "image/png", data: sourceImage } },
  { inlineData: { mimeType: "image/png", data: maskImage } },
  { text: prompt }
]
```

The prompt text references the mask: "The second image is a mask. Edit ONLY the white regions of the first image."

`dispatchInpaint` in `inpaint.processor.ts` must also pass `maskBuffer` through to `geminiInpaint()` (currently it receives the mask but doesn't forward it).

When no mask is provided, behavior is unchanged (single image + prompt).

### 4. Add padding to inpaint processor

In `inpaint.processor.ts`, after downloading the source image (and mask), pad both to the generation aspect ratio before sending to Gemini:
- **Source image**: `padToAspectRatio(imageBuffer, aspectRatio)` — uses `extendWith: "mirror"` (existing behavior)
- **Mask image**: `padToAspectRatio(maskBuffer, aspectRatio, "black")` — extend with black (= "don't edit padding regions"). Add an `extendWith` parameter to `padToAspectRatio()`.

The existing `cropToKDP` step after generation removes only the padding.

### 5. Remove padding from generation processor

Remove the `padToAspectRatio` call and import from `generation.processor.ts`. This code only runs for bake (guarded by `generation.includeLayers`), and bake is moving to inpaint.

### 6. Bake prompt adjustments

Replace `buildBakeLayersPrompt()` to reflect the new approach — text/images are already rendered on the flattened canvas, the AI just needs to blend them:

- **Stylized**: "The second image is a mask showing regions where text/layers were placed onto the cover. Integrate the content in these masked regions into the artwork with creative, genre-appropriate effects — embossing, glow, texture, shadows. Make it look like a professionally designed cover. Do not modify anything outside the masked regions."
- **Clean**: "The second image is a mask showing regions where text/layers were placed onto the cover. Blend the content in these masked regions cleanly into the composition — add subtle shadows or contrast adjustments for legibility. Do not apply decorative effects. Do not modify anything outside the masked regions."

The function no longer lists individual layer names/text since the AI can see the rendered text directly.

### 7. Support `imageCount` for inpaint and bake

The worker already supports `imageCount` for inpaint (loops, progress messages, partial failure). But the API and client hardcode it to 1. Pipe it through:

- **`createInpaintSchema`** in `src/lib/validations.ts`: add optional `imageCount` field (same constraints as generation: `z.number().int().min(1).max(8)`)
- **`CreateInpaintParams`** in `src/lib/api/generations.ts`: add optional `imageCount` field
- **`/api/inpaint` route**: read `imageCount` from parsed body (default 1), pass to `reserveCredits` and job data. Credit cost = `calculateCreditCost(model, imageCount)`.
- **`InpaintJobData`** in `inpaint.processor.ts`: `imageCount` field already exists (optional, defaults to 1). No processor changes needed.

### 8. Inpaint toolbar changes

- `handleSubmitBake` calls `onBakeSubmit(bakePrompt)` (new prop from hook)
- Image count slider visible in both bake and inpaint modes
- Credit cost in bake/inpaint mode = `perImageCost * imageCount`
- Style toggle (Stylized/Clean) remains for bake — controls which prompt variant is used

## Files to Modify

| File | Change |
|------|--------|
| `src/components/editor/use-inpaint-state.ts` | Add `generateLayerMask()`, `handleBakeSubmit()`, pass `imageCount` to `createInpaint`, expose via return value and ref |
| `src/components/editor/inpaint-toolbar.tsx` | Replace `buildBakeLayersPrompt()`, call `onBakeSubmit` instead of `onGenerateSimilar`, show image count slider in bake/inpaint modes |
| `src/components/editor/editor-shell.tsx` | Wire new `onBakeSubmit` prop from inpaint hook to toolbar |
| `src/lib/validations.ts` | Add optional `imageCount` to `createInpaintSchema` |
| `src/lib/api/generations.ts` | Add optional `imageCount` to `CreateInpaintParams` |
| `src/app/api/inpaint/route.ts` | Read `imageCount` from body, use in `reserveCredits` and job data |
| `worker/src/services/gemini.service.ts` | Send `maskBuffer` as second `inlineData` part when present |
| `worker/src/processors/inpaint.processor.ts` | Pass `maskBuffer` through `dispatchInpaint` → `geminiInpaint`, add `padToAspectRatio` on source + mask |
| `worker/src/processors/generation.processor.ts` | Remove `padToAspectRatio` call and import |
| `worker/src/services/image.service.ts` | Add `extendWith` parameter to `padToAspectRatio()` (default "mirror", mask uses "black") |
