# Remove Inpainting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the entire inpaint/Edit Region feature, simplify the toolbar to Generate + Similar + Bake Layers, and route bake back through the generation pipeline.

**Architecture:** Delete 4 files (brush-tool, use-inpaint-state, inpaint API route, inpaint processor). Remove inpaint code from ~15 other files. Move `flattenCanvasToDataUrl` into `use-generation-actions`. Re-add bake padding to generation processor. Rename toolbar. Drop `maskImage` column via migration.

**Tech Stack:** TypeScript, React, Konva, Prisma, BullMQ, Sharp

---

### Task 1: Remove worker inpaint processor and Gemini inpaint function

**Files:**
- Delete: `worker/src/processors/inpaint.processor.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/services/gemini.service.ts`
- Modify: `worker/src/lib/constants.ts`

- [ ] **Step 1: Delete inpaint processor**

```bash
rm worker/src/processors/inpaint.processor.ts
```

- [ ] **Step 2: Remove INPAINT routing from worker index**

In `worker/src/index.ts`, remove the `processInpaint` import (line 6) and the INPAINT branch in the job dispatcher (lines 31-32). The dispatcher becomes:

```typescript
  async (job) => {
    console.log(`[worker] Processing job ${job.id} (${job.name}): generation ${job.data.generationId} (attempt ${job.attemptsMade + 1})`);
    await processGeneration(job);
    console.log(`[worker] Completed job ${job.id}`);
  },
```

- [ ] **Step 3: Remove `inpaintImage` from Gemini service**

In `worker/src/services/gemini.service.ts`, delete the `GeminiInpaintParams` interface and the `inpaintImage` function entirely (from `export interface GeminiInpaintParams` through the end of the `inpaintImage` function).

- [ ] **Step 4: Remove INPAINT from worker constants**

In `worker/src/lib/constants.ts`:
- Remove `INPAINT: "inpaint"` from `JOB_TYPE`
- Remove `JOB_TYPE.INPAINT` from all `capabilities` arrays in `AI_MODELS`

- [ ] **Step 5: Re-add bake padding to generation processor**

In `worker/src/processors/generation.processor.ts`, add `padToAspectRatio` back to the import:

```typescript
import { cropToKDP, padToAspectRatio } from "../services/image.service.js";
```

After the reference image download block (after `refBuffer` is set, before the loop), add:

```typescript
      // Bake mode: pad reference to generation aspect ratio so crop only removes padding
      if (generation.includeLayers && geminiConfig?.aspectRatio && refBuffer) {
        refBuffer = await padToAspectRatio(refBuffer, geminiConfig.aspectRatio);
      }
```

- [ ] **Step 6: Revert `padToAspectRatio` to remove `extendWith` parameter**

In `worker/src/services/image.service.ts`, remove the `extendWith` parameter — revert to always using `"mirror"`:

```typescript
export async function padToAspectRatio(
  imageBuffer: Buffer,
  targetAspectRatio: string,
): Promise<Buffer> {
```

And revert the extend call to:

```typescript
  return sharp(imageBuffer)
    .extend({ top: padTop, bottom: padBottom, extendWith: "mirror" })
    .toBuffer();
```

- [ ] **Step 7: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 8: Commit**

```bash
git add -A worker/
git commit -m "refactor: remove inpaint processor, Gemini inpaint function, and worker routing"
```

---

### Task 2: Remove app-side inpaint API, validation, and client

**Files:**
- Delete: `src/app/api/inpaint/route.ts`
- Modify: `src/lib/validations.ts`
- Modify: `src/lib/api/generations.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Delete inpaint API route**

```bash
rm src/app/api/inpaint/route.ts
```

Also remove the directory if empty: `rmdir src/app/api/inpaint`

- [ ] **Step 2: Remove `createInpaintSchema` from validations**

In `src/lib/validations.ts`, delete the entire `createInpaintSchema` block.

- [ ] **Step 3: Remove `CreateInpaintParams` and `createInpaint` from API client**

In `src/lib/api/generations.ts`, delete the `CreateInpaintParams` interface and the `createInpaint` function.

- [ ] **Step 4: Remove INPAINT from app constants**

In `src/lib/constants.ts`:
- Remove `INPAINT: "inpaint"` from `JOB_TYPE`
- Remove `JOB_TYPE.INPAINT` from all `capabilities` arrays in `AI_MODELS`

- [ ] **Step 5: Remove inpaint extension from extend route**

In `src/app/api/generations/[id]/extend/route.ts`:
- Remove the `isInpaintExtension` check and the entire `if (isInpaintExtension)` block (lines 99-119)
- Remove `maskImage` from the generation select query (line 44 or similar)
- The `else` block (regular generation extension) becomes the only path — remove the `else` wrapper

- [ ] **Step 6: Remove maskImage from cleanup routes**

In these three files, remove `maskImage` from the generation query select and from the storage cleanup logic:
- `src/app/api/images/batch/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/account/route.ts`

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: Errors from editor components still referencing inpaint — that's fine, we fix those next.

- [ ] **Step 8: Commit**

```bash
git add -A src/app/api/ src/lib/
git commit -m "refactor: remove inpaint API, validation, client, and extension routing"
```

---

### Task 3: Remove Prisma `maskImage` field and regenerate clients

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `worker/prisma/schema.prisma`

- [ ] **Step 1: Remove `maskImage` from both schemas**

In both `prisma/schema.prisma` and `worker/prisma/schema.prisma`, delete the line:
```
  maskImage         String?
```

Keep `includeLayers` — it's still used for bake.

- [ ] **Step 2: Create migration**

```bash
npx prisma migrate dev --name remove_mask_image
```

- [ ] **Step 3: Regenerate worker Prisma client**

```bash
cd worker && npx prisma generate
```

- [ ] **Step 4: Type-check both**

```bash
npx tsc --noEmit
cd worker && npx tsc --noEmit
```

Expected: App may still have errors from editor components. Worker should be clean.

- [ ] **Step 5: Commit**

```bash
git add prisma/ worker/prisma/ src/generated/ worker/src/generated/
git commit -m "refactor: remove maskImage column from Generation model"
```

---

### Task 4: Delete brush tool and inpaint state hook

**Files:**
- Delete: `src/components/editor/brush-tool.tsx`
- Delete: `src/components/editor/use-inpaint-state.ts`

- [ ] **Step 1: Delete both files**

```bash
rm src/components/editor/brush-tool.tsx
rm src/components/editor/use-inpaint-state.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A src/components/editor/
git commit -m "refactor: delete brush tool and inpaint state hook"
```

---

### Task 5: Move `flattenCanvasToDataUrl` into `use-generation-actions`

**Files:**
- Modify: `src/components/editor/use-generation-actions.ts`
- Modify: `src/components/editor/editor-shell.tsx`

- [ ] **Step 1: Add stageRef parameter and flattenCanvasToDataUrl to `useGenerationActions`**

In `src/components/editor/use-generation-actions.ts`:

Replace the `inpaintRef` parameter with `stageRef`:

```typescript
export function useGenerationActions(
  projectId: string,
  projectGenerations: Generation[],
  attributes: AttributeSelection,
  canvasNodes: CanvasNode[],
  selectedImageId: string | null,
  stageRef: React.RefObject<import("konva").default.Stage | null>,
  router: ReturnType<typeof useRouter>,
  tier: string = "FREE",
): UseGenerationActionsResult {
```

Add the `flattenCanvasToDataUrl` function inside the hook (copy from the deleted `use-inpaint-state.ts`):

```typescript
  async function flattenCanvasToDataUrl(): Promise<string | undefined> {
    const stage = stageRef.current;
    if (!stage) return undefined;
    await new Promise((r) => setTimeout(r, 50));
    await document.fonts.ready;
    const layers = stage.getLayers();
    const hiddenLayers: import("konva").default.Layer[] = [];
    for (let i = 2; i < layers.length; i++) {
      if (layers[i].visible()) {
        layers[i].visible(false);
        hiddenLayers.push(layers[i]);
      }
    }
    const dataUrl = stage.toDataURL({
      pixelRatio: KDP.width / CANVAS_WIDTH,
      mimeType: "image/jpeg",
      quality: 0.9,
    });
    for (const layer of hiddenLayers) {
      layer.visible(true);
    }
    return dataUrl;
  }
```

Add necessary imports: `KDP` from `@/lib/constants`, `CANVAS_WIDTH` from `./canvas-types`.

Update `handleGenerateSimilar` to call `flattenCanvasToDataUrl()` directly instead of `inpaintRef.current.flattenCanvasToDataUrl()`.

Remove the `UseInpaintStateResult` import and the `inpaintRef` parameter type.

- [ ] **Step 2: Update editor-shell wiring**

In `src/components/editor/editor-shell.tsx`:
- Remove the `inpaintRef` and `useRef` setup for it
- Remove `useInpaintState` import and hook call
- Remove `inpaintRef.current = inpaint` sync
- Pass `stageRef` directly to `useGenerationActions` instead of `inpaintRef`:

```typescript
  const genActions = useGenerationActions(
    project.id, project.generations,
    attributes, nodes, selectedImageId,
    stageRef, router, tier,
  );
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: Errors from toolbar/center-panel still referencing inpaint props — fix in next tasks.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/use-generation-actions.ts src/components/editor/editor-shell.tsx
git commit -m "refactor: move flattenCanvasToDataUrl to use-generation-actions, remove inpaint ref"
```

---

### Task 6: Refactor toolbar — remove inpaint, simplify generate

**Files:**
- Rename: `src/components/editor/inpaint-toolbar.tsx` → `src/components/editor/editor-toolbar.tsx`
- Modify: `src/components/editor/editor-shell.tsx`

- [ ] **Step 1: Rename file**

```bash
mv src/components/editor/inpaint-toolbar.tsx src/components/editor/editor-toolbar.tsx
```

- [ ] **Step 2: Gut inpaint/brush code from toolbar**

In `src/components/editor/editor-toolbar.tsx`:

**Remove from `ToolbarMode`**: `"brush"` and `"inpaint"` — keep `"idle" | "similar" | "bake"`

**Remove props** from interface (and destructuring):
- `brushMode`, `setBrushMode`, `selectedImageUrl`, `brushSize`, `setBrushSize`, `erasing`, `setErasing`, `onBrushUndo`, `onBrushClear`, `onBrushDone`, `hasBrushMask`
- `inpaintMask`, `inpaintSubmitting`, `onInpaintSubmit`, `onCancelInpaint`, `onRepaint`
- `includeLayers`, `onIncludeLayersChange`
- `onBakeSubmit`, `bakeSubmitting`

**Remove state**: `inpaintPrompt`/`setInpaintPrompt`

**Remove mode computation branches**: `inpaintMask ? "inpaint" :` and `brushMode ? "brush" :`

**Remove credit cost special case**: Change `const creditCost = perImageCost * imageCount;` (already correct after recent changes, but verify no inpaint branch remains).

**Remove toolbar sections**: `mode === "brush"` and `mode === "inpaint"` render blocks entirely.

**Remove "Edit Region" button** from idle mode.

**Remove split button dropdown** on Generate — make it a simple `<Button>` that calls `onRegenerate`. Remove the `DropdownMenu` wrapper, `ChevronDown` icon, and the `Similar` menu item. Add Similar as a standalone button instead.

**Remove popover sections**: The inpaint popover (`mode === "inpaint"` popover). Keep similar and bake popovers.

**Remove `renderPopoverBody` inpaint branch**: Remove the `includeLayers` switch from the popover body. Simplify — the function only handles `"similar" | "bake"` now.

**Bake submission**: `handleSubmitBake` calls `onGenerateSimilar(bakePrompt, true)` (back to original). Remove the `onBakeSubmit` call. Remove the `bakeSubmitting` prop — use local state again:

```typescript
  const [bakeSubmitting, setBakeSubmitting] = useState(false);

  async function handleSubmitBake() {
    setBakeSubmitting(true);
    try {
      await onGenerateSimilar(bakePrompt, true);
      setBakeOpen(false);
      setBakePrompt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBakeSubmitting(false);
    }
  }
```

**Remove unused imports**: `Paintbrush`, `Eraser`, `Undo2`, `RotateCcw`, `Switch`, `DropdownMenu*` components, etc.

- [ ] **Step 3: Update editor-shell to use renamed toolbar**

In `src/components/editor/editor-shell.tsx`:
- Change import from `./inpaint-toolbar` to `./editor-toolbar`
- Change component name from `<InpaintToolbar>` to `<EditorToolbar>`
- Remove all inpaint/brush props passed to the toolbar. The remaining props are:

```typescript
<EditorToolbar
  onRegenerate={genActions.handleRegenerate}
  activeGenerationCount={genActions.allActiveIds.length}
  selectedImageId={selectedImageId}
  onGenerateSimilar={genActions.handleGenerateSimilar}
  model={genActions.model}
  setModel={genActions.setModel}
  imageCount={genActions.imageCount}
  setImageCount={genActions.setImageCount}
  tier={tier}
  nodes={nodes}
/>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: Errors from editor-center-panel — fixed in next task.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/editor/
git commit -m "refactor: rename toolbar, remove inpaint/brush UI, simplify generate button"
```

---

### Task 7: Clean up editor center panel

**Files:**
- Modify: `src/components/editor/editor-center-panel.tsx`

- [ ] **Step 1: Remove brush/inpaint props and rendering**

Remove from `EditorCenterPanelProps` interface:
- `brushMode`, `inpaintMask`, `brushSize`, `erasing`, `brushToolRef`, `setInpaintMask`, `setHasBrushMask`

Remove from the component:
- Brush mode cursor styling (`brushMode && !inpaintMask` check)
- Canvas node selection disabled when `brushMode`
- `BrushTool` component rendering
- Mask overlay image display
- `BrushTool` import

- [ ] **Step 2: Update editor-shell prop passing**

In `src/components/editor/editor-shell.tsx`, remove brush/inpaint props from `<EditorCenterPanel>`:
Remove: `brushMode`, `inpaintMask`, `brushSize`, `erasing`, `brushToolRef`, `setInpaintMask`, `setHasBrushMask`

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean (or minor errors in generation-group/queue — fixed next).

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/editor-center-panel.tsx src/components/editor/editor-shell.tsx
git commit -m "refactor: remove brush tool and mask overlay from editor center panel"
```

---

### Task 8: Clean up generation history, queue, and helpers

**Files:**
- Modify: `src/components/editor/generation-helpers.ts`
- Modify: `src/components/editor/generation-group.tsx`
- Modify: `src/components/editor/generation-queue.tsx`

- [ ] **Step 1: Remove INPAINT from generation helpers**

In `generation-helpers.ts`:
- Remove `Wand2` import
- Remove `[JOB_TYPE.INPAINT]: Wand2` from `JOB_TYPE_ICON`
- Remove `JOB_TYPE` import if only used for INPAINT (check)

- [ ] **Step 2: Remove inpaint rendering from generation-group**

In `generation-group.tsx`:
- Remove inpaint icon display logic
- Remove inpaint prompt display block (`jobType === JOB_TYPE.INPAINT`)
- Remove parent image navigation for inpaint
- Remove system prompt hiding for inpaint jobs

- [ ] **Step 3: Remove inpaint from generation-queue**

In `generation-queue.tsx`:
- Remove inpaint edit prompt display (`jobType === JOB_TYPE.INPAINT`)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/generation-helpers.ts src/components/editor/generation-group.tsx src/components/editor/generation-queue.tsx
git commit -m "refactor: remove inpaint references from generation history and queue UI"
```

---

### Task 9: Final type-check, clean up, and update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full type-check both packages**

```bash
npx tsc --noEmit
cd worker && npx tsc --noEmit
```

Fix any remaining type errors.

- [ ] **Step 2: Update CLAUDE.md**

Remove all inpaint references:
- Generation Pipeline: remove `JOB_TYPE.INPAINT` routing, inpaint processor description, mask persistence section
- Editor Architecture: remove `useInpaintState` from hooks list, remove brush tool references, update toolbar description
- Update Bake Layers section: routes through `GENERATE_FROM_REFERENCE` again, no mask
- Update Important Conventions: remove inpaint-related entries
- Remove `inpaintImage` reference from Gemini service description

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md after inpaint removal"
```
