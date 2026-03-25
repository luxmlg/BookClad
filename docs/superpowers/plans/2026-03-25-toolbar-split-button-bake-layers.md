# Toolbar Split Button & Bake Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the editor toolbar so Generate has a dropdown for "Similar", and a new "Bake Layers" button sends the image + visible canvas layers to the AI for incorporation.

**Architecture:** Reuses the existing `GENERATE_FROM_REFERENCE` pipeline — no API/worker changes. The toolbar gains a `"bake"` mode and a split button pattern using base-ui Menu. `handleGenerateSimilar` accepts an explicit `includeLayers` param instead of reading from ref state.

**Tech Stack:** React, @base-ui/react (Menu, Popover), lucide-react, Konva canvas types

---

### Task 1: Add `buildBakeLayersPrompt` utility function

**Files:**
- Modify: `src/components/editor/inpaint-toolbar.tsx:1-36` (add import for `CanvasNode`)

This is a pure function placed at the top of the toolbar file (before the component). It builds a prompt string from visible canvas nodes.

- [ ] **Step 1: Add the `CanvasNode` import and utility function**

At the top of `src/components/editor/inpaint-toolbar.tsx`, add to imports:

```typescript
import type { CanvasNode } from "./canvas-types";
```

Then, before the `InpaintToolbarProps` interface (line 40), add:

```typescript
function buildBakeLayersPrompt(nodes: CanvasNode[]): string {
  const visible = nodes.filter((n) => n.visible);
  if (visible.length === 0) return "";
  const lines = visible.map((n) => {
    if (n.type === "text") return `${n.name ?? "Text"} text: "${n.text}"`;
    return `Image layer: "${n.name ?? n.id}"`;
  });
  return `Incorporate these elements into the cover image naturally:\n${lines.map((l) => `- ${l}`).join("\n")}`;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/inpaint-toolbar.tsx
git commit -m "feat: add buildBakeLayersPrompt utility for bake layers feature"
```

---

### Task 2: Refactor `handleGenerateSimilar` to accept explicit `includeLayers` param

**Files:**
- Modify: `src/components/editor/use-generation-actions.ts:16-36,38-47,141-168`
- Modify: `src/components/editor/editor-shell.tsx:160-163`
- Modify: `src/components/editor/inpaint-toolbar.tsx:60,135-146`

All three files must change together for type-check to pass.

- [ ] **Step 1: Update `UseGenerationActionsResult` interface**

In `src/components/editor/use-generation-actions.ts`, change line 32:

```typescript
// Before:
handleGenerateSimilar: (prompt: string) => Promise<void>;
// After:
handleGenerateSimilar: (prompt: string, includeLayers: boolean) => Promise<void>;
```

- [ ] **Step 2: Update `handleGenerateSimilar` implementation**

In `src/components/editor/use-generation-actions.ts`, change the function signature and body (lines 141-168):

```typescript
// Before (line 141):
async function handleGenerateSimilar(prompt: string) {
// After:
async function handleGenerateSimilar(prompt: string, includeLayers: boolean) {
```

Replace line 143:
```typescript
// Before:
const shouldIncludeLayers = inpaintRef.current.includeLayers;
// After:
const shouldIncludeLayers = includeLayers;
```

- [ ] **Step 3: Simplify `inpaintRef` type — remove `includeLayers`**

In `src/components/editor/use-generation-actions.ts`, change line 44:

```typescript
// Before:
inpaintRef: React.RefObject<Pick<UseInpaintStateResult, "includeLayers" | "flattenCanvasToDataUrl">>,
// After:
inpaintRef: React.RefObject<Pick<UseInpaintStateResult, "flattenCanvasToDataUrl">>,
```

- [ ] **Step 4: Update `inpaintRef` initial value in `editor-shell.tsx`**

In `src/components/editor/editor-shell.tsx`, update the ref initial value (lines 160-163):

```typescript
// Before:
const inpaintRef = useRef<{ includeLayers: boolean; flattenCanvasToDataUrl: () => Promise<string | undefined> }>({
  includeLayers: false,
  flattenCanvasToDataUrl: async () => undefined,
});
// After:
const inpaintRef = useRef<{ flattenCanvasToDataUrl: () => Promise<string | undefined> }>({
  flattenCanvasToDataUrl: async () => undefined,
});
```

Also find where `inpaintRef.current` is assigned (search for `inpaintRef.current =` or `inpaintRef.current.includeLayers`) and remove the `includeLayers` assignment if present.

- [ ] **Step 5: Update toolbar prop type and call site**

In `src/components/editor/inpaint-toolbar.tsx`, change line 60:

```typescript
// Before:
onGenerateSimilar: (prompt: string) => void;
// After:
onGenerateSimilar: (prompt: string, includeLayers: boolean) => void;
```

Update `handleSubmitSimilar` (line 138) to pass `false`:

```typescript
// Before:
await onGenerateSimilar(similarPrompt);
// After:
await onGenerateSimilar(similarPrompt, false);
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/use-generation-actions.ts src/components/editor/editor-shell.tsx src/components/editor/inpaint-toolbar.tsx
git commit -m "refactor: make handleGenerateSimilar accept explicit includeLayers param"
```

---

### Task 3: Restructure toolbar — split button, bake layers, mode changes

**Files:**
- Modify: `src/components/editor/inpaint-toolbar.tsx` (major changes across the file)
- Modify: `src/components/editor/editor-shell.tsx:817-861` (pass `nodes` prop)

This is the main UI task. Changes to the toolbar:
1. Add `"bake"` to `ToolbarMode`
2. Add `nodes: CanvasNode[]` prop
3. Add `bakeOpen`/`bakePrompt` state and bake handlers
4. Split Generate into grouped buttons with dropdown
5. Add Bake Layers button (conditional on visible nodes)
6. Add bake mode rendering (submit/cancel)
7. Add Bake Layers popover
8. Remove "Include canvas layers" toggle from similar popover (keep in inpaint)

- [ ] **Step 1: Add imports**

In `src/components/editor/inpaint-toolbar.tsx`, add to the lucide-react import (line 4):

```typescript
import { Layers, ChevronDown } from "lucide-react";
```

Add dropdown menu imports:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

- [ ] **Step 2: Update `ToolbarMode` type and add `nodes` prop**

Change line 38:

```typescript
// Before:
type ToolbarMode = "idle" | "brush" | "similar" | "inpaint";
// After:
type ToolbarMode = "idle" | "brush" | "similar" | "bake" | "inpaint";
```

Add `nodes` prop to `InpaintToolbarProps` (after `tier` at line 67):

```typescript
nodes: CanvasNode[];
```

Add `nodes` to the destructured props.

- [ ] **Step 3: Add bake state and handlers**

After line 104 (`const [inpaintPrompt, setInpaintPrompt] = useState("")`), add:

```typescript
const [bakeOpen, setBakeOpen] = useState(false);
const [bakePrompt, setBakePrompt] = useState("");
const [bakeSubmitting, setBakeSubmitting] = useState(false);
```

Derive `hasVisibleLayers`:

```typescript
const hasVisibleLayers = nodes.some((n) => n.visible);
```

Update mode derivation (lines 107-111) to include `"bake"`:

```typescript
const mode: ToolbarMode =
  inpaintMask ? "inpaint" :
    brushMode ? "brush" :
      similarOpen ? "similar" :
        bakeOpen ? "bake" :
          "idle";
```

Update credit cost calculation (line 114) to include bake:

```typescript
const creditCost = mode === "inpaint" ? perImageCost : perImageCost * imageCount;
```

(No change needed — bake uses `perImageCost * imageCount` like similar, which is the default.)

Add reset for bake state in the `selectedImageId` effect (after line 120):

```typescript
setBakeOpen(false);
setBakePrompt("");
```

Add bake handlers after `handleCancelSimilar` (line 133):

```typescript
function handleOpenBake() {
  setBakePrompt(buildBakeLayersPrompt(nodes));
  setBakeOpen(true);
}

function handleCancelBake() {
  setBakeOpen(false);
  setBakePrompt("");
}

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

- [ ] **Step 4: Update `renderPopoverBody` to support bake mode and conditionally show toggle**

Change the function signature (line 218):

```typescript
// Before:
function renderPopoverBody(popoverMode: "similar" | "inpaint") {
// After:
function renderPopoverBody(popoverMode: "similar" | "inpaint" | "bake") {
```

Update the prompt/setPrompt bindings (lines 219-221):

```typescript
const isSimilar = popoverMode === "similar";
const isBake = popoverMode === "bake";
const prompt = isBake ? bakePrompt : isSimilar ? similarPrompt : inpaintPrompt;
const setPrompt = isBake ? setBakePrompt : isSimilar ? setSimilarPrompt : setInpaintPrompt;
```

Update the Ctrl+Enter handler (lines 227-231):

```typescript
if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
  e.preventDefault();
  if (isBake) handleSubmitBake();
  else if (isSimilar) handleSubmitSimilar();
  else handleSubmitInpaint();
}
if (e.key === "Escape") {
  e.preventDefault();
  if (isBake) handleCancelBake();
  else if (!isSimilar) handleCancelInpaint();
}
```

Update the label (lines 239-243):

```typescript
<Label className="text-xs">
  {isBake ? "Instructions" : isSimilar ? "Additional instructions" : "Describe the replacement"}
  {isSimilar && (
    <span className="font-normal text-muted-foreground"> (optional)</span>
  )}
</Label>
```

Update the placeholder (lines 248-251):

```typescript
placeholder={
  isBake
    ? "Describe how to incorporate the layers..."
    : isSimilar
      ? "e.g. More dramatic, warmer tones..."
      : "e.g. Replace with a starry sky..."
}
```

**Only show the toggle for inpaint mode.** Replace lines 258-267:

```typescript
{popoverMode === "inpaint" && (
  <div className="flex items-center justify-between">
    <Label htmlFor={`include-layers-${popoverMode}`} className="text-xs">
      Include canvas layers
    </Label>
    <Switch
      id={`include-layers-${popoverMode}`}
      checked={includeLayers}
      onCheckedChange={onIncludeLayersChange}
    />
  </div>
)}
```

- [ ] **Step 5: Replace idle mode buttons with split button + Bake Layers**

Replace the idle mode section (lines 279-323) with:

```tsx
{mode === "idle" && (
  <>
    {/* Split Generate button */}
    <div className="flex">
      <Button
        size="sm"
        className="h-7 gap-1.5 rounded-r-none border-r-0 text-xs"
        onClick={onRegenerate}
        disabled={insufficientCredits}
        title={insufficientCredits ? `Not enough credits (need ${creditCost}, have ${creditBalance})` : `${creditCost} credits`}
      >
        <RefreshCw className="size-3.5" />
        Generate
        {activeGenerationCount > 0 && (
          <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-bold">
            {activeGenerationCount}
          </span>
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="default"
              size="sm"
              className="h-7 rounded-l-none border-l border-primary-foreground/20 px-1.5 text-xs"
              disabled={insufficientCredits}
            />
          }
        >
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" sideOffset={8} align="start">
          <DropdownMenuItem
            onClick={() => setSimilarOpen(true)}
            disabled={!selectedImageId}
          >
            <Sparkles className="mr-2 size-3.5" />
            Similar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    {/* Bake Layers — only when visible layers exist */}
    {hasVisibleLayers && (
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={handleOpenBake}
        disabled={!selectedImageId || insufficientCredits}
      >
        <Layers className="size-3.5" />
        Bake Layers
      </Button>
    )}

    <div className="mx-1 h-5 w-px bg-border" />
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 text-xs"
      onClick={() => setBrushMode(true)}
      disabled={!selectedImageUrl}
    >
      <Paintbrush className="size-3.5" />
      Edit Region
    </Button>
    <div className="mx-1 h-5 w-px bg-border" />
    {modelSelector}
    {imageCountSlider}
    <div className="mx-1 h-5 w-px bg-border" />
    {renderCostBadge()}
  </>
)}
```

- [ ] **Step 6: Add bake mode rendering**

After the similar mode section (line 416), add the bake mode:

```tsx
{/* ── Bake mode ──────────────────────── */}
{mode === "bake" && (
  <>
    <Button
      size="sm"
      className="h-7 gap-1.5 text-xs"
      onClick={handleSubmitBake}
      disabled={bakeSubmitting || insufficientCredits}
    >
      {bakeSubmitting ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Layers className="size-3.5" />
      )}
      Bake Layers · {renderCostBadge(true)}
    </Button>
    <div className="mx-1 h-5 w-px bg-border" />
    {modelSelector}
    {imageCountSlider}
    <div className="mx-1 h-5 w-px bg-border" />
    <button
      onClick={handleCancelBake}
      className="p-1 text-muted-foreground hover:text-foreground"
      title="Cancel (Esc)"
    >
      <X className="size-3.5" />
    </button>
  </>
)}
```

- [ ] **Step 7: Add Bake Layers popover**

After the inpaint popover (line 478), add:

```tsx
{/* ── Bake Layers popover ────────────── */}
<PopoverPrimitive.Root open={mode === "bake"}>
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner className="isolate z-50" anchor={toolbarRef} side="top" sideOffset={8} align="center">
      <PopoverPrimitive.Popup className="z-50 w-72 rounded-lg border bg-popover p-3 shadow-md">
        {renderPopoverBody("bake")}
      </PopoverPrimitive.Popup>
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
```

- [ ] **Step 8: Pass `nodes` from `editor-shell.tsx`**

In `src/components/editor/editor-shell.tsx`, add the `nodes` prop to the `InpaintToolbar` render (around line 857, after the `tier` prop):

```typescript
nodes={nodes}
```

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/components/editor/inpaint-toolbar.tsx src/components/editor/editor-shell.tsx
git commit -m "feat: split Generate button with Similar dropdown and add Bake Layers button"
```

---

### Verification

1. `npx tsc --noEmit` — clean build
2. Editor with image + visible layers — toolbar shows `[Generate | ▾] [Bake Layers] [Edit Region]`
3. Editor with image + no visible layers — toolbar shows `[Generate | ▾] [Edit Region]` (no Bake Layers)
4. Click ▾ dropdown — shows "Similar" menu item
5. Click "Similar" — toolbar transitions to similar mode, popover appears with prompt textarea, **no** "Include canvas layers" toggle
6. Submit Similar — generates reference-based images without layers
7. Click "Bake Layers" — toolbar transitions to bake mode, popover appears with pre-filled prompt describing visible text/image layers
8. Submit Bake — generates reference-based images with flattened canvas layers
9. After Bake generation completes — visible layers are stripped from result images (existing behavior)
10. Edit Region → inpaint popover — **still has** "Include canvas layers" toggle
11. No image selected — dropdown "Similar" disabled, Bake Layers disabled
12. Insufficient credits — all generation actions disabled
