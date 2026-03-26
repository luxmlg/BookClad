# Surgical Bake via Inpaint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route bake through the inpaint pipeline with auto-generated masks so Gemini only edits layer regions, add padding to the inpaint processor, and support `imageCount` for inpaint/bake.

**Architecture:** Seven changes: (1) `padToAspectRatio` gets an `extendWith` param, (2) Gemini service sends mask when present, (3) inpaint processor passes mask through and pads source+mask, (4) generation processor drops bake padding, (5) inpaint API+validation support `imageCount`, (6) `use-inpaint-state` gets mask generation and bake submission, (7) toolbar routes bake through new hook method.

**Tech Stack:** TypeScript, Konva, Sharp, Gemini API, Prisma, BullMQ

---

### Task 1: Add `extendWith` parameter to `padToAspectRatio`

**Files:**
- Modify: `worker/src/services/image.service.ts`

- [ ] **Step 1: Add `extendWith` parameter**

Change the function signature to accept an optional third parameter. Default to `"mirror"` for backwards compatibility.

```typescript
export async function padToAspectRatio(
  imageBuffer: Buffer,
  targetAspectRatio: string,
  extendWith: "mirror" | "copy" | "background" = "mirror",
): Promise<Buffer> {
```

In the `sharp().extend()` call, change `extendWith: "mirror"` to use the parameter. When `extendWith === "background"`, set `background: { r: 0, g: 0, b: 0, alpha: 255 }`:

```typescript
  const extendOptions: sharp.ExtendOptions = {
    top: padTop,
    bottom: padBottom,
    extendWith: extendWith === "background" ? "background" : extendWith,
    ...(extendWith === "background" ? { background: { r: 0, g: 0, b: 0, alpha: 255 } } : {}),
  };

  return sharp(imageBuffer)
    .extend(extendOptions)
    .toBuffer();
```

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add worker/src/services/image.service.ts
git commit -m "feat: add extendWith parameter to padToAspectRatio"
```

---

### Task 2: Send mask to Gemini in `inpaintImage`

**Files:**
- Modify: `worker/src/services/gemini.service.ts`

- [ ] **Step 1: Send maskBuffer as second inlineData part**

In `inpaintImage()`, destructure `maskBuffer` from params (it's already in the interface but unused). When present, insert it as a second part between the source image and the text prompt:

```typescript
export async function inpaintImage({
  imageBuffer,
  maskBuffer,
  prompt,
  modelId,
  config,
}: GeminiInpaintParams): Promise<Buffer> {
  // ...

  const parts: Array<Record<string, unknown>> = [
    {
      inlineData: {
        mimeType: "image/png",
        data: imageBuffer.toString("base64"),
      },
    },
  ];

  if (maskBuffer) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: maskBuffer.toString("base64"),
      },
    });
  }

  parts.push({ text: prompt });
```

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add worker/src/services/gemini.service.ts
git commit -m "feat: send mask as second inlineData part to Gemini when present"
```

---

### Task 3: Inpaint processor — pass mask through, add padding

**Files:**
- Modify: `worker/src/processors/inpaint.processor.ts`

- [ ] **Step 1: Import `padToAspectRatio`**

Add to imports:

```typescript
import { cropToKDP, padToAspectRatio } from "../services/image.service.js";
```

Update `dispatchInpaint` to forward `maskBuffer`:

```typescript
async function dispatchInpaint(
  model: string,
  imageBuffer: Buffer,
  maskBuffer: Buffer,
  prompt: string
): Promise<Buffer> {
  const geminiModelId = GEMINI_MODEL_IDS[model];
  if (!geminiModelId) throw new Error(`Unknown model: ${model}`);
  const config = GEMINI_MODEL_CONFIG[model];
  return geminiInpaint({ imageBuffer, maskBuffer, prompt, modelId: geminiModelId, config });
}
```

- [ ] **Step 2: Pad source image and mask before Gemini call**

After downloading the source image and mask (around line 104-111), add padding. Read the aspect ratio from the model config:

```typescript
    // Pad source + mask to generation aspect ratio so cropToKDP only removes padding
    const aspectRatio = GEMINI_MODEL_CONFIG[model]?.aspectRatio;
    if (aspectRatio) {
      imageBuffer = await padToAspectRatio(imageBuffer, aspectRatio);
      maskBuffer = await padToAspectRatio(maskBuffer, aspectRatio, "background");
    }
```

Note: `imageBuffer` and `maskBuffer` are currently `const` — change them to `let` where they're first assigned (around lines 105-111).

- [ ] **Step 3: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add worker/src/processors/inpaint.processor.ts
git commit -m "feat: pass mask to Gemini, add aspect-ratio padding to inpaint processor"
```

---

### Task 4: Remove bake padding from generation processor

**Files:**
- Modify: `worker/src/processors/generation.processor.ts`

- [ ] **Step 1: Remove padding code and import**

Remove the `padToAspectRatio` import (change `import { cropToKDP, padToAspectRatio }` back to `import { cropToKDP }`).

Remove the padding block after the reference image download (the `if (generation.includeLayers && geminiConfig?.aspectRatio)` block, around lines 110-113).

- [ ] **Step 2: Type-check**

Run: `cd worker && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add worker/src/processors/generation.processor.ts
git commit -m "refactor: remove bake padding from generation processor (moved to inpaint)"
```

---

### Task 5: Support `imageCount` in inpaint API

**Files:**
- Modify: `src/lib/validations.ts`
- Modify: `src/lib/api/generations.ts`
- Modify: `src/app/api/inpaint/route.ts`

- [ ] **Step 1: Add `imageCount` to validation schema**

In `src/lib/validations.ts`, add to `createInpaintSchema`:

```typescript
export const createInpaintSchema = z.object({
  imageId: z.string().min(1),
  maskDataUrl: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  model: z.enum(modelValues).optional().default("quick"),
  imageCount: z.number().int().min(1).max(MAX_IMAGES_PER_GENERATION).optional().default(1),
  flattenedImageDataUrl: z.string().optional(),
  ...snapshotFields,
});
```

- [ ] **Step 2: Add `imageCount` to client type**

In `src/lib/api/generations.ts`, add to `CreateInpaintParams`:

```typescript
export interface CreateInpaintParams {
  imageId: string;
  maskDataUrl: string;
  prompt: string;
  model?: string;
  imageCount?: number;
  flattenedImageDataUrl?: string;
  attributeSnapshot?: AttributeSelection;
  textLayerSnapshot?: TextLayerEntry[];
}
```

- [ ] **Step 3: Use `imageCount` in API route**

In `src/app/api/inpaint/route.ts`, destructure `imageCount` from `parsed.data` (alongside existing fields). Update the `reserveCredits` call to use `imageCount` instead of hardcoded `1`:

```typescript
    const {
      imageId,
      maskDataUrl,
      prompt,
      model,
      imageCount,
      flattenedImageDataUrl,
      attributeSnapshot,
      textLayerSnapshot,
    } = parsed.data;

    // ...

    const creditCost = calculateCreditCost(model, imageCount);

    // ... in reserveCredits:
    const { generationId } = await reserveCredits(session.user.id, creditCost, {
      // ...
      imageCount,
      // ...
    });

    // ... in queue.add job data:
    await getGenerationQueue().add(JOB_TYPE.INPAINT, {
      // ...
      imageCount,
      creditCost,
    });
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations.ts src/lib/api/generations.ts src/app/api/inpaint/route.ts
git commit -m "feat: support imageCount for inpaint API"
```

---

### Task 6: Add mask generation and bake submission to `use-inpaint-state`

**Files:**
- Modify: `src/components/editor/use-inpaint-state.ts`

- [ ] **Step 1: Add `generateLayerMask` function**

Add inside `useInpaintState`, after `flattenCanvasToDataUrl`:

```typescript
  function generateLayerMask(): string | null {
    const stage = stageRef.current;
    if (!stage) return null;

    const scale = KDP.width / CANVAS_WIDTH;
    const canvas = document.createElement("canvas");
    canvas.width = KDP.width;
    canvas.height = KDP.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Fill with black (don't edit)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw white rectangles for each visible layer node
    ctx.fillStyle = "#ffffff";
    const padding = 20 * scale; // 20px canvas-space padding for blending room
    const layers = stage.getLayers();
    for (const layer of layers) {
      for (const node of layer.getChildren()) {
        const id = node.id();
        // Skip background image and non-layer nodes
        if (!id || node.getClassName() === "Image" && !node.getAttr("assetId")) continue;
        if (!node.visible()) continue;

        const rect = node.getClientRect();
        const x = Math.max(0, rect.x * scale - padding);
        const y = Math.max(0, rect.y * scale - padding);
        const w = Math.min(canvas.width - x, rect.width * scale + padding * 2);
        const h = Math.min(canvas.height - y, rect.height * scale + padding * 2);
        ctx.fillRect(x, y, w, h);
      }
    }

    return canvas.toDataURL("image/png");
  }
```

- [ ] **Step 2: Add `handleBakeSubmit` function**

Add after `handleInpaintSubmit`. This mirrors `handleInpaintSubmit` but generates the mask from layer bounds instead of using the brush mask:

```typescript
  async function handleBakeSubmit(prompt: string, imageCount: number) {
    if (!selectedImageId) {
      toast.error("Please select an image first");
      return;
    }
    const maskDataUrl = generateLayerMask();
    if (!maskDataUrl) {
      toast.error("Failed to generate layer mask");
      return;
    }
    setBakeSubmitting(true);
    try {
      const flattenedImageDataUrl = await flattenCanvasToDataUrl();
      const data = await createInpaint({
        imageId: selectedImageId,
        maskDataUrl,
        prompt,
        model,
        imageCount,
        flattenedImageDataUrl,
        attributeSnapshot: attributes,
        textLayerSnapshot: canvasNodes.filter(n => n.visible !== false).map((n) => ({
          name: n.name ?? n.id,
          text: n.type === NODE_TYPE.TEXT ? (n.text ?? "") : "",
          type: n.type,
        })),
      });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setPendingSlotCounts(prev => new Map(prev).set(data.generationId, imageCount));
      setPanelOpen(true);
      setActiveTab(0);
      refreshCredits();
      toast.success("Bake layers queued!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bake failed");
    } finally {
      setBakeSubmitting(false);
    }
  }
```

This needs new state and imports. Add:
- `import { createInpaint } from "@/lib/api";` — already imported
- `const [bakeSubmitting, setBakeSubmitting] = useState(false);` — new state
- `const refreshCredits = useCreditStore((s) => s.refreshCredits);` — new import + call

Also add `useCreditStore` import: `import { useCreditStore } from "@/lib/stores/credit-store";`

- [ ] **Step 3: Expose in return value and interface**

Add to `UseInpaintStateResult` interface:

```typescript
  handleBakeSubmit: (prompt: string, imageCount: number) => Promise<void>;
  bakeSubmitting: boolean;
```

Add to the return object:

```typescript
    handleBakeSubmit,
    bakeSubmitting,
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/use-inpaint-state.ts
git commit -m "feat: add generateLayerMask and handleBakeSubmit to inpaint state"
```

---

### Task 7: Wire bake through inpaint in toolbar and shell

**Files:**
- Modify: `src/components/editor/inpaint-toolbar.tsx`
- Modify: `src/components/editor/editor-shell.tsx`

- [ ] **Step 1: Update `buildBakeLayersPrompt` for inpaint approach**

Replace the function body. It no longer lists individual layer names — the AI can see the rendered text in the flattened image. It just needs style instructions referencing the mask:

```typescript
function buildBakeLayersPrompt(style: BakeStyle): string {
  if (style === "stylized") {
    return "The second image is a mask showing regions where text/layers were placed onto the cover. Integrate the content in these masked regions into the artwork with creative, genre-appropriate effects — embossing, glow, texture, shadows. Make it look like a professionally designed cover. Do not modify anything outside the masked regions.";
  }
  return "The second image is a mask showing regions where text/layers were placed onto the cover. Blend the content in these masked regions cleanly into the composition — add subtle shadows or contrast adjustments for legibility. Do not apply decorative effects. Do not modify anything outside the masked regions.";
}
```

Remove the `nodes` parameter — it's no longer needed. Update all call sites: `buildBakeLayersPrompt(style)` (remove `nodes` argument from `handleOpenBake` and `handleBakeStyleChange`).

- [ ] **Step 2: Add `onBakeSubmit` prop and update `handleSubmitBake`**

Add to `InpaintToolbarProps`:

```typescript
  onBakeSubmit: (prompt: string, imageCount: number) => Promise<void>;
  bakeSubmitting: boolean;
```

Remove the local `bakeSubmitting` state — it now comes from props.

In `handleSubmitBake`, replace `onGenerateSimilar(bakePrompt, true)` with `onBakeSubmit(bakePrompt, imageCount)`:

```typescript
  async function handleSubmitBake() {
    try {
      await onBakeSubmit(bakePrompt, imageCount);
      setBakeOpen(false);
      setBakePrompt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }
```

Remove the old `setBakeSubmitting` calls — the hook manages this state now.

- [ ] **Step 3: Show image count slider in inpaint mode**

Currently the image count slider is hidden in inpaint mode (only shows in idle, similar, bake). Find the `imageCountSlider` usage in inpaint mode and add it. In the `mode === "inpaint"` toolbar section, add `{imageCountSlider}` after the model selector (same pattern as other modes).

- [ ] **Step 4: Wire in editor-shell**

In `editor-shell.tsx`, pass the new props from `inpaint` hook to the toolbar:

```typescript
onBakeSubmit={inpaint.handleBakeSubmit}
bakeSubmitting={inpaint.bakeSubmitting}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/inpaint-toolbar.tsx src/components/editor/editor-shell.tsx
git commit -m "feat: route bake through inpaint with auto-mask, show image count in inpaint/bake"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update bake documentation**

Update the "Bake Layers" section in the Generation Pipeline to reflect the new inpaint-based flow:
- Bake now routes through `JOB_TYPE.INPAINT` (not `GENERATE_FROM_REFERENCE`)
- Auto-generates mask from visible layer bounding boxes via `generateLayerMask()`
- Mask sent to Gemini as second `inlineData` part
- Padding applied to both source image (mirror) and mask (black) in inpaint processor
- `imageCount` now supported for inpaint/bake

Update the "Bake aspect-ratio padding" section: padding is now in the inpaint processor, not generation processor. Both source image and mask are padded.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for surgical bake via inpaint"
```
