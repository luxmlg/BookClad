# AI Fill Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve AI Fill with a better system prompt (more creative, holistic) and add inline editing to the review dialog so users can tweak suggestions before applying.

**Architecture:** Two independent changes: (1) rewrite the SYSTEM_PROMPT constant in `src/lib/ai-fill.ts` with new principles, (2) add editing state and per-type inline editors to the review dialog. The review dialog gets a new `attributeConfig` prop for looking up available values.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, shadcn/ui + base-ui

**Spec:** `docs/superpowers/specs/2026-03-22-ai-fill-improvements-design.md`

---

## File Structure

### Modified Files
| File | Change |
|------|--------|
| `src/lib/ai-fill.ts` | Replace `SYSTEM_PROMPT` constant |
| `src/components/editor/ai-fill-review-dialog.tsx` | Add inline editing: `editingIndex` state, `editedSuggestions` state, `SuggestionEditor` component, `attributeConfig` prop |
| `src/components/editor/left-sidebar.tsx` | Pass `attributeConfig` to `AiFillReviewDialog` |

No new files needed.

---

## Task 1: Rewrite System Prompt

**Files:**
- Modify: `src/lib/ai-fill.ts:104-144`

- [ ] **Step 1: Replace the `SYSTEM_PROMPT` constant**

Replace the entire `SYSTEM_PROMPT` constant (lines 104–144) with:

```typescript
const SYSTEM_PROMPT = `You are a creative book cover design consultant. Your goal is to give users the best possible attribute setup for generating stunning ebook covers.

You will receive:
1. The user's full attribute configuration — every attribute with its id, type, available values, and descriptions
2. The user's current selections for each attribute
3. The user's direction — what they want to change, improve, or create

## Attribute Types

- "single": Pick exactly one value (or create a new one with value/label/description)
- "multi": Pick one or more values as tags (or create new ones)
- "text": Free-form descriptive content — write vivid, specific descriptions
- "toggle": "true" or "false"
- "scale": A number from 0 to 10 as a string (e.g. "7")
- "color": A hex color value like "#3b82f6"
- "palette": A curated color set. IMPORTANT: When creating new palette values, you MUST include a "colors" array with exactly 5 hex color strings, e.g. ["#0a0a0f", "#1a1a2e", "#4a1942", "#c84b31", "#fbbf24"]. Palette values without a colors array are broken and unusable.

## Your Approach

**Think holistically.** When the user's direction shifts the vibe of the cover, update everything that's affected — genre, mood, art style, palette, visual elements, and more. Don't leave attributes describing the old direction.

**Always rewrite Visual Elements.** This is the most impactful attribute for generation quality. When the direction changes, rewrite it completely with vivid, specific imagery that matches the new vision. Never leave it stale.

**Prefer structure over text dumps.** If a concept can be its own attribute (Lighting, Camera Angle, Atmosphere, Setting, Time of Day, Composition, etc.), suggest it as a new structured attribute rather than cramming everything into the Visual Elements text field. Structured attributes give users more control and produce better generations.

**Be generous with suggestions.** Suggest 2-3 new attributes when they would improve generation quality. The cost of suggesting too many is low — users can uncheck what they don't want. The cost of suggesting too few is a mediocre cover. Good new attributes to consider: Lighting, Camera Angle/Perspective, Atmosphere, Setting/Environment, Time of Day, Composition Style, Figure Pose/Action, Typography Style.

**Respect the user's custom work.** If the user has manually created custom attributes, don't modify them unless the direction specifically relates to them.

## Value Creation Rules

- For existing attributes with predefined values, prefer picking from existing values. Only create new values when nothing existing fits well.
- When creating new values: provide a slug-style "value", a human-readable "label", and a "description" explaining how it affects the cover.
- For palette-type attributes: always include a "colors" array with exactly 5 hex color strings.
- For new attributes: provide a full definition with name, type, description, and initial values.

## Response Format

Respond with valid JSON:
{
  "suggestions": [
    {
      "attributeId": "exact-id-from-config or null for new",
      "name": "Attribute Name",
      "type": "single|multi|text|toggle|scale|color|palette",
      "value": "selected-value-slug" or ["value1", "value2"],
      "isNew": false,
      "newValues": [{"value": "slug", "label": "Display Label", "description": "How this affects the cover", "colors": ["#hex1", ...]}],
      "newAttribute": { "name": "...", "type": "...", "description": "...", "values": [...], "scaleLabels": {"min": "...", "max": "..."} }
    }
  ]
}

- Set "isNew": true and include "newAttribute" for brand new attributes not in the current config.
- Set "newValues" when adding values that don't exist in the attribute's current value list.
- CRITICAL: For "attributeId", use the exact id shown in brackets [id: "..."] in the attribute list. Set to null only for brand new attributes.
- Do NOT include explanations, reasoning, or commentary — only the JSON object.`;
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai-fill.ts
git commit -m "feat(ai-fill): rewrite system prompt for holistic, creative suggestions"
```

---

## Task 2: Add Inline Editing to Review Dialog

**Files:**
- Modify: `src/components/editor/ai-fill-review-dialog.tsx`
- Modify: `src/components/editor/left-sidebar.tsx`

This is the larger task. The review dialog gets:
1. A new `attributeConfig` prop
2. `editedSuggestions` local state (mutable copy of suggestions)
3. `editingIndex` state tracking which row is expanded
4. Split click handling: checkbox vs content area
5. A `SuggestionEditor` component that renders type-appropriate inputs

- [ ] **Step 1: Read existing component files for reference**

Read these files to understand existing patterns:
- `src/components/editor/attribute-input.tsx` — how existing attribute type inputs work
- `src/components/editor/ai-fill-review-dialog.tsx` — current review dialog
- `src/components/ui/combobox.tsx` — for single/palette dropdown patterns
- `src/lib/attributes.ts` — `Attribute`, `AttributeValue`, `AttributeConfigJson` types

- [ ] **Step 2: Update `AiFillReviewDialogProps` to accept `attributeConfig`**

Add the prop:

```typescript
import type { AttributeConfigJson, Attribute } from "@/lib/attributes";

interface AiFillReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: AiFillSuggestion[];
  attributeConfig: AttributeConfigJson;  // NEW
  onApply: (selected: AiFillSuggestion[]) => void;
  onRegenerate: () => void;
}
```

- [ ] **Step 3: Add `editedSuggestions` and `editingIndex` state**

Inside `AiFillReviewDialog`, add state for the mutable suggestion copies and which row is being edited:

```typescript
const [editedSuggestions, setEditedSuggestions] = useState<AiFillSuggestion[]>(suggestions);
const [editingIndex, setEditingIndex] = useState<number | null>(null);

// Reset when suggestions change (render-time pattern)
const [prevSuggestions, setPrevSuggestions] = useState<AiFillSuggestion[]>(suggestions);
if (suggestions !== prevSuggestions) {
  setPrevSuggestions(suggestions);
  setSelected(new Set(suggestions.map((_, i) => String(i))));
  setEditedSuggestions(suggestions);
  setEditingIndex(null);
}
```

Update `handleApply` to use `editedSuggestions` instead of `suggestions`:

```typescript
function handleApply(): void {
  const selectedSuggestions = editedSuggestions.filter((_, i) =>
    selected.has(String(i)),
  );
  onApply(selectedSuggestions);
  onOpenChange(false);
}
```

Add a handler to update a single suggestion's value:

```typescript
function handleEditValue(index: number, value: string | string[]): void {
  setEditedSuggestions((prev) =>
    prev.map((s, i) => (i === index ? { ...s, value } : s))
  );
}
```

Helper to resolve the `Attribute` definition for a suggestion (for looking up available values):

```typescript
function resolveAttribute(suggestion: AiFillSuggestion): Attribute | null {
  if (suggestion.attributeId) {
    return attributeConfig.attributes.find((a) => a.id === suggestion.attributeId) ?? null;
  }
  if (suggestion.newAttribute) {
    return {
      id: suggestion.newAttribute.name.toLowerCase().replace(/\s+/g, "-"),
      name: suggestion.newAttribute.name,
      type: suggestion.newAttribute.type,
      builtIn: false,
      enabled: true,
      description: suggestion.newAttribute.description,
      values: (suggestion.newAttribute.values ?? []).map((v) => ({ ...v, builtIn: false })),
      scaleLabels: suggestion.newAttribute.scaleLabels,
    };
  }
  return null;
}
```

- [ ] **Step 4: Split click handling in `SuggestionRow`**

Update `SuggestionRow` to have two click targets: the checkbox and the content area. Add an `onEdit` callback and `editing` flag.

```typescript
interface SuggestionRowProps {
  suggestion: AiFillSuggestion;
  checked: boolean;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
}
```

Replace the single `<button>` wrapper with a `<div>` containing separate click areas:

```tsx
function SuggestionRow({ suggestion, checked, editing, onToggle, onEdit }: SuggestionRowProps) {
  const newValueCount = suggestion.newValues?.length ?? 0;

  return (
    <div className={`flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 ${editing ? "bg-muted/50" : ""}`}>
      {/* Checkbox — click toggles selection */}
      <button type="button" onClick={onToggle} className="mt-0.5 shrink-0">
        <div
          className={`flex size-4 items-center justify-center rounded border transition-colors ${
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background"
          }`}
        >
          {checked && <Check className="size-3" />}
        </div>
      </button>

      {/* Content — click opens editor */}
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-medium text-foreground">{suggestion.name}</span>
            {suggestion.isNew && (
              <Badge variant="secondary" className="h-4 text-[10px]">NEW</Badge>
            )}
            {newValueCount > 0 && (
              <Badge variant="outline" className="h-4 text-[10px]">+{newValueCount} new</Badge>
            )}
            <Pencil className="size-3 text-muted-foreground opacity-0 group-hover/row:opacity-100 transition-opacity" />
          </div>
          <p className="text-xs text-foreground/80">{formatAttrValue(suggestion.value)}</p>
          {suggestion.previousValue !== undefined && (
            <p className="text-xs text-muted-foreground">was: {formatAttrValue(suggestion.previousValue)}</p>
          )}
        </div>
      </button>
    </div>
  );
}
```

Add `group/row` class to the outer div for hover effects: `className={`group/row flex w-full ...`}`.

- [ ] **Step 5: Create `SuggestionEditor` component**

Add a `SuggestionEditor` component within the same file that renders the appropriate input for each attribute type. It appears below the `SuggestionRow` when `editing` is true.

```typescript
interface SuggestionEditorProps {
  suggestion: AiFillSuggestion;
  attribute: Attribute | null;
  onChange: (value: string | string[]) => void;
  onClose: () => void;
}

function SuggestionEditor({ suggestion, attribute, onChange, onClose }: SuggestionEditorProps) {
  const type = suggestion.type;
  const value = suggestion.value;

  // Merge existing attribute values with any new values from the suggestion
  const availableValues = [
    ...(attribute?.values ?? []),
    ...(suggestion.newValues ?? []).map((nv) => ({
      ...nv,
      builtIn: false,
    })),
  ];

  // Remove duplicates by value
  const uniqueValues = availableValues.filter(
    (v, i, arr) => arr.findIndex((a) => a.value === v.value) === i
  );

  if (type === "text") {
    return (
      <div className="px-2 pb-2">
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>
    );
  }

  if (type === "single" || type === "palette") {
    return (
      <div className="px-2 pb-2">
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
        >
          {uniqueValues.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "multi") {
    const selected = Array.isArray(value) ? value : [value];
    return (
      <div className="flex flex-wrap gap-1 px-2 pb-2">
        {uniqueValues.map((v) => {
          const isSelected = selected.includes(v.value);
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => {
                const next = isSelected
                  ? selected.filter((s) => s !== v.value)
                  : [...selected, v.value];
                onChange(next);
              }}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (type === "scale") {
    const numValue = typeof value === "string" ? parseInt(value, 10) || 5 : 5;
    return (
      <div className="flex items-center gap-2 px-2 pb-2">
        {attribute?.scaleLabels && (
          <span className="text-[10px] text-muted-foreground">{attribute.scaleLabels.min}</span>
        )}
        <input
          type="range"
          min={0}
          max={10}
          value={numValue}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        {attribute?.scaleLabels && (
          <span className="text-[10px] text-muted-foreground">{attribute.scaleLabels.max}</span>
        )}
        <span className="text-xs font-medium w-5 text-center">{numValue}</span>
      </div>
    );
  }

  if (type === "toggle") {
    return (
      <div className="flex items-center gap-2 px-2 pb-2">
        <button
          type="button"
          onClick={() => onChange(value === "true" ? "false" : "true")}
          className={`rounded-full border px-3 py-0.5 text-[11px] transition-colors ${
            value === "true"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          {value === "true" ? "On" : "Off"}
        </button>
      </div>
    );
  }

  if (type === "color") {
    return (
      <div className="flex items-center gap-2 px-2 pb-2">
        <input
          type="color"
          value={typeof value === "string" ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-6 rounded border-none"
        />
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
        />
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 6: Wire up editing in the main dialog render**

In the main dialog, update how suggestion rows are rendered to include editing state and the editor below expanded rows. Update both `updatedSuggestions` and `newSuggestions` sections to use `editedSuggestions` for display, and render `SuggestionEditor` when the row is being edited:

```tsx
{updatedSuggestions.map(({ index }) => {
  const suggestion = editedSuggestions[index];
  const isEditing = editingIndex === index;
  return (
    <div key={index}>
      <SuggestionRow
        suggestion={suggestion}
        checked={selected.has(String(index))}
        editing={isEditing}
        onToggle={() => handleToggle(index)}
        onEdit={() => setEditingIndex(isEditing ? null : index)}
      />
      {isEditing && (
        <SuggestionEditor
          suggestion={suggestion}
          attribute={resolveAttribute(suggestion)}
          onChange={(value) => handleEditValue(index, value)}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
})}
```

Apply the same pattern to the `newSuggestions` section.

Also update `updatedSuggestions` and `newSuggestions` to derive from `editedSuggestions`:

```typescript
const updatedSuggestions = editedSuggestions
  .map((s, i) => ({ suggestion: s, index: i }))
  .filter(({ suggestion }) => !suggestion.isNew);

const newSuggestions = editedSuggestions
  .map((s, i) => ({ suggestion: s, index: i }))
  .filter(({ suggestion }) => suggestion.isNew);
```

- [ ] **Step 7: Pass `attributeConfig` from `LeftSidebar`**

In `src/components/editor/left-sidebar.tsx`, add `attributeConfig` to the `AiFillReviewDialog` usage:

```tsx
<AiFillReviewDialog
  open={reviewOpen}
  onOpenChange={setReviewOpen}
  suggestions={aiFillSuggestions}
  attributeConfig={attributeConfig}  // ADD THIS
  onApply={handleApplyAiFill}
  onRegenerate={handleAiFillRegenerate}
/>
```

- [ ] **Step 8: Add `Pencil` import**

Add `Pencil` to the lucide-react import in the review dialog file:

```typescript
import { Check, Pencil } from "lucide-react";
```

- [ ] **Step 9: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 10: Manual test**

1. Start dev: `npm run dev`
2. Open editor, click AI Fill, type a direction, generate
3. In the review dialog:
   - Click a checkbox → should toggle selection
   - Click the value area → row should expand with appropriate editor
   - Edit a text value → textarea appears, editable
   - Edit a single/palette value → dropdown appears
   - Edit multi value → tag toggles appear
   - Click another row → previous editor closes, new one opens
   - Press Escape → editor closes
   - Click Apply → edited values are applied to the sidebar
4. Verify no regressions

- [ ] **Step 11: Commit**

```bash
git add src/components/editor/ai-fill-review-dialog.tsx src/components/editor/left-sidebar.tsx
git commit -m "feat(ai-fill): add inline editing to review dialog"
```
