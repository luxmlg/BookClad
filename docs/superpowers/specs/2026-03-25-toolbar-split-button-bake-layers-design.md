# Toolbar Split Button & Bake Layers

## Goal
Restructure the editor toolbar to make "Generate Similar" accessible via a dropdown on the Generate button, and replace the old "Generate Similar" button with a new "Bake Layers" button that sends the current image + visible canvas layers to the AI for incorporation.

## Current State

Toolbar idle mode (with image selected):
```
[Generate] [Generate Similar] [Edit Region] | [Model ▾] [1 ○○○ 8] [💰 3]
```

- "Generate Similar" opens a popover with optional prompt + "Include canvas layers" toggle
- Sends the selected image as reference to Gemini for image-to-image generation
- "Include canvas layers" toggle flattens visible Konva nodes onto the background before sending
- Clicking "Generate Similar" sets `similarOpen = true`, which transitions the toolbar to `"similar"` mode — idle buttons are replaced with submit/cancel controls while the popover floats above

## New Toolbar Layout

**Idle mode — no visible layers:**
```
[Generate | ▾] [Edit Region] | [Model ▾] [1 ○○○ 8] [💰 3]
```

**Idle mode — with visible layers:**
```
[Generate | ▾] [Bake Layers] [Edit Region] | [Model ▾] [1 ○○○ 8] [💰 3]
```

**Similar mode** (after clicking "Similar" from dropdown):
Same as the current similar-mode toolbar — idle buttons replaced with submit/cancel, popover above. Unchanged behavior.

**Bake mode** (after clicking "Bake Layers"):
Same pattern as similar mode — idle buttons replaced with submit/cancel, popover above with pre-filled prompt.

## Toolbar Mode Changes

The existing `ToolbarMode` type (`"idle" | "brush" | "similar" | "inpaint"`) gains a new value: `"bake"`. This mode mirrors `"similar"` — the toolbar shows submit/cancel inline while the Bake Layers popover floats above.

## Generate Split Button

Two visually grouped buttons sharing a border:
- **Left (Generate):** Fires `onRegenerate()` — generates fresh covers from attributes. Unchanged behavior.
- **Right (▾ chevron):** Opens a `DropdownMenu` with a single "Similar" item. Clicking "Similar" transitions the toolbar to `"similar"` mode and opens the Similar popover.

The dropdown uses `@base-ui/react` `Menu` primitives, consistent with the rest of the UI. The Similar popover must be rendered as a **sibling** of the dropdown (not a child), with shared state — per the base-ui constraint that `DropdownMenuContent` unmounts children when the menu closes.

## Similar Popover (via dropdown)

Same as the current Generate Similar popover with one change:
- **Remove** the "Include canvas layers" toggle — that responsibility moves to Bake Layers
- Keep the optional prompt textarea (placeholder: "e.g. More dramatic, warmer tones...")
- Same keyboard shortcuts (Ctrl/Cmd+Enter to submit, Escape handling)
- `handleGenerateSimilar` always called with `includeLayers: false`
- The "Include canvas layers" toggle in the **Inpaint** popover is **unchanged** — inpaint is a separate flow

## Bake Layers Button

**Visibility:** Only rendered when `canvasState.nodes.some(n => n.visible)` — at least one visible layer exists. Hidden otherwise. Note: default Title/Author text nodes start with `visible: true`, so the button will appear on fresh projects with default text layers. This is correct — those are layers the user would want to incorporate.

**Icon:** `Layers` from lucide-react.

**Click behavior:** Transitions toolbar to `"bake"` mode and opens a popover (same style as Similar) with:

1. **Pre-filled prompt textarea** — auto-generated from visible canvas nodes:
   - Text nodes: `Title text: "Crown of Embers"`
   - Image nodes: `Image layer: "author-photo"` (uses node `name`, falls back to `node.id` if `name` is undefined)
   - Format: `"Incorporate these elements into the cover image naturally:\n- Title text: 'Crown of Embers'\n- Author text: 'R.K. Ashwood'"`
   - User can freely edit before submitting

2. **No "Include canvas layers" toggle** — always sends the flattened canvas

3. **Submit button** with Ctrl/Cmd+Enter shortcut

**Under the hood:** Calls the same generation pipeline as Similar:
- Calls `handleGenerateSimilar` with `includeLayers: true` forced
- Uses the prompt from the textarea
- Same job type: `GENERATE_FROM_REFERENCE` with `flattenedImageDataUrl`
- Same credit cost: `perImageCost * imageCount` (same as Similar)
- Persists `textLayerSnapshot` with the generation (same as Similar with `includeLayers: true`) for diff display in history
- No new API routes or worker changes needed

**Post-generation layer cleanup:** The existing behavior in `editor-shell.tsx` (lines 328-335) applies — when a generation completes with `includeLayers === true`, visible layers are stripped from the result images (only hidden nodes carry over). This prevents duplication since the text/images are now baked into the generated cover. This behavior is already implemented and applies automatically to Bake Layers generations.

### Auto-prompt builder

A pure function `buildBakeLayersPrompt(nodes: CanvasNode[]): string` that:
1. Filters to `visible: true` nodes only
2. For `TextNodeConfig`: extracts `text` content
3. For `ImageNodeConfig`: uses `name` field, falls back to `node.id` if undefined
4. Returns formatted prompt string

## Handler Refactoring

`handleGenerateSimilar` in `use-generation-actions.ts` currently reads `includeLayers` from `inpaintRef.current.includeLayers`. Change the signature to accept it explicitly:

```typescript
handleGenerateSimilar(prompt: string, includeLayers: boolean): void
```

The toolbar calls this with:
- `handleGenerateSimilar(prompt, false)` from Similar popover
- `handleGenerateSimilar(prompt, true)` from Bake Layers popover

The `onGenerateSimilar` prop on `InpaintToolbarProps` updates to match: `onGenerateSimilar: (prompt: string, includeLayers: boolean) => void`.

## Disabled States

- **Generate dropdown "Similar"**: Disabled when no image is selected (needs a reference image)
- **Bake Layers**: Hidden when no visible layers exist. Disabled when no image is selected.
- Both respect `insufficientCredits` — disabled when user lacks credits
- Both respect generation-in-progress state (`isGenerating`)

## Files to Modify

- `src/components/editor/inpaint-toolbar.tsx` — Split button, Bake Layers button + mode, remove toggle from Similar popover (keep in Inpaint), auto-prompt builder function, update `ToolbarMode` type
- `src/components/editor/use-generation-actions.ts` — Change `handleGenerateSimilar` signature to accept explicit `includeLayers: boolean` parameter
- `src/components/editor/editor-shell.tsx` — Pass `canvasState` or derived `hasVisibleLayers` boolean to toolbar, update `onGenerateSimilar` call site
