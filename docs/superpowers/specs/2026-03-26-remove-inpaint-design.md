# Remove Inpainting Design

## Goal

Remove the entire inpaint/Edit Region feature (brush tool, mask handling, inpaint API, inpaint processor). Simplify the toolbar to: Generate (simple button), Similar, and Bake Layers. Route bake back through the generation pipeline (`GENERATE_FROM_REFERENCE`). App is not deployed — no backwards compatibility needed.

## Delete entirely

| File | Reason |
|------|--------|
| `src/components/editor/brush-tool.tsx` | Brush drawing UI |
| `src/components/editor/use-inpaint-state.ts` | Inpaint hook (brush mode, mask, inpaint/bake submission) |
| `src/app/api/inpaint/route.ts` | Inpaint API endpoint |
| `worker/src/processors/inpaint.processor.ts` | Inpaint job processor |

## Remove from worker

- **`worker/src/services/gemini.service.ts`**: Delete `inpaintImage()` function and `GeminiInpaintParams` interface.
- **`worker/src/index.ts`**: Remove `processInpaint` import and `JOB_TYPE.INPAINT` routing in job dispatcher.
- **`worker/src/lib/constants.ts`**: Remove `INPAINT` from `JOB_TYPE`. Remove `JOB_TYPE.INPAINT` from all `AI_MODELS` capabilities arrays.
- **`worker/src/services/image.service.ts`**: The `extendWith` parameter on `padToAspectRatio` is no longer needed (was for mask padding). Revert to original signature without the parameter — only `"mirror"` is used.

## Remove from app

- **`src/lib/constants.ts`**: Remove `INPAINT` from `JOB_TYPE`. Remove `JOB_TYPE.INPAINT` from all `AI_MODELS` capabilities arrays.
- **`src/lib/validations.ts`**: Delete `createInpaintSchema`.
- **`src/lib/api/generations.ts`**: Delete `CreateInpaintParams` interface and `createInpaint()` function.
- **`src/app/api/generations/[id]/extend/route.ts`**: Remove the inpaint extension branch (`isInpaintExtension` check, `JOB_TYPE.INPAINT` job queuing). Extensions for existing inpaint generations should fall through to the regular generation extension path or be rejected.
- **`src/app/api/images/batch/route.ts`**: Remove `maskImage` from query select and storage cleanup.
- **`src/app/api/projects/[id]/route.ts`**: Remove `maskImage` from query select and storage cleanup.
- **`src/app/api/account/route.ts`**: Remove `maskImage` from query select and storage cleanup.

## Schema changes

- **Both `prisma/schema.prisma` files**: Remove `maskImage String?` from Generation model. Keep `includeLayers` (used by bake).
- **Migration**: Create new migration to drop `maskImage` column.
- **Regenerate both Prisma clients** after schema changes.

## Toolbar refactor

Rename `src/components/editor/inpaint-toolbar.tsx` → `src/components/editor/editor-toolbar.tsx`.

Remove:
- `ToolbarMode` values: `"brush"`, `"inpaint"` — keep `"idle"`, `"similar"`, `"bake"`
- All brush-related props: `brushMode`, `setBrushMode`, `brushSize`, `setBrushSize`, `erasing`, `setErasing`, `onBrushUndo`, `onBrushClear`, `onBrushDone`, `hasBrushMask`, `selectedImageUrl`
- All inpaint-related props: `inpaintMask`, `inpaintSubmitting`, `onInpaintSubmit`, `onCancelInpaint`, `onRepaint`, `includeLayers`, `onIncludeLayersChange`
- Bake-specific props that came from the deleted hook: `onBakeSubmit`, `bakeSubmitting`
- All brush mode toolbar UI (Eraser, Undo, Clear, brush size slider)
- All inpaint mode toolbar UI (Apply button, Re-paint button, inpaint popover)
- "Edit Region" button in idle mode
- Split button dropdown on Generate (make it a simple button)

Keep:
- Generate button (simple, calls `onRegenerate`)
- Similar button (opens similar popover with prompt textarea)
- Bake Layers button with Stylized/Clean toggle
- Model selector, image count slider, credit cost badge

**Bake submission**: `handleSubmitBake` calls `onGenerateSimilar(bakePrompt, true)` — back to the original flow through the generation pipeline.

## Move `flattenCanvasToDataUrl`

Currently in `use-inpaint-state.ts` (being deleted). Used by:
- `handleGenerateSimilar` (when `includeLayers=true` for bake/similar)

Move to `use-generation-actions.ts`. Pass `stageRef` directly to the hook instead of going through the inpaint ref. The function uses Konva's `stage.toDataURL()` to export at KDP resolution.

## Editor shell changes

- Remove `useInpaintState` hook and all its prop wiring
- Remove `inpaintRef` — pass `stageRef` directly to `useGenerationActions`
- Remove brush/mask props passed to `EditorCenterPanel` and toolbar
- Update imports

## Editor center panel changes

- Remove `BrushTool` component rendering
- Remove mask overlay image display
- Remove brush-mode cursor styling
- Remove brush-related props from `EditorCenterPanelProps`

## Generation history/queue changes

- **`generation-group.tsx`**: Remove inpaint icon (`Wand2`), inpaint prompt display, parent image navigation
- **`generation-queue.tsx`**: Remove inpaint edit prompt display
- **`generation-helpers.ts`**: Remove `INPAINT` from `JOB_TYPE_ICON`

## Generation processor (keep)

`worker/src/processors/generation.processor.ts` — no changes needed. It already handles `includeLayers` and `flattenedImageDataUrl` for bake via `GENERATE_FROM_REFERENCE`. The padding logic we added earlier stays here for bake mode.

Wait — we removed padding from the generation processor in Task 4 and moved it to inpaint. Now that inpaint is gone, we need to add padding back for bake in the generation processor.

## Re-add padding to generation processor

Re-add `padToAspectRatio` to `generation.processor.ts` for bake mode:
```
if (generation.includeLayers && geminiConfig?.aspectRatio) {
  refBuffer = await padToAspectRatio(refBuffer, geminiConfig.aspectRatio);
}
```

## CLAUDE.md

Heavy update — remove all inpaint references, update toolbar description, update bake flow, update generation pipeline.
