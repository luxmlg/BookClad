# AI Fill Improvements: Better Prompt + Inline Editing

## Overview

Two improvements to the AI Fill feature:
1. Rewrite the system prompt to be more creative, holistic, and generous with suggestions
2. Add inline editing to the review dialog so users can tweak suggestions before applying

## 1. System Prompt Rewrite

### Current Problems

The current prompt is conservative:
- "Only suggest changes that are RELEVANT" — causes the AI to leave stale attributes untouched
- "Keep new attribute suggestions practical" — discourages helpful new attributes
- No guidance on Visual Elements — the most impactful attribute gets ignored when direction shifts
- No encouragement to create structured attributes over text dumps

### New Prompt Principles

1. **Always rewrite Visual Elements** to match the user's direction — never leave it describing something that no longer fits
2. **Think holistically** — when the direction shifts the vibe, update genre, mood, art style, palette, and visual elements together
3. **Prefer structure over text** — if something can be its own attribute (Lighting, Atmosphere, Camera Angle, Setting, Time of Day), suggest it as a new attribute rather than cramming it into Visual Elements
4. **Suggest 2-3 new attributes per fill** when they'd improve generation quality — the cost of suggesting too many is low (user can uncheck), the cost of too few is a mediocre result
5. **No explanations or reasoning** in the response — just structured JSON
6. **Respect custom attributes** — don't touch attributes the user manually created unless the direction specifically relates to them

### Guardrails (unchanged)

- For existing attributes with predefined values, prefer existing values; only create new when nothing fits
- For palette attributes, always include 5 hex colors in the `colors` array
- Use exact attribute IDs from the config (`[id: "..."]` notation)
- New values need slug-style value, human-readable label, and description

### What Changes

Only the `SYSTEM_PROMPT` constant in `src/lib/ai-fill.ts`. No structural changes to types, Zod schemas, or API logic.

## 2. Review Dialog Inline Editing

### Interaction Model

- **Click checkbox** → toggle include/exclude (existing behavior)
- **Click row content** (name/value area) → expand row to show inline editor
- **Click another row or press Escape** → collapse current editor
- Only one row can be in edit mode at a time
- Edited values replace the suggestion's value in local state — Apply uses whatever the user set

### Per-Type Editors

| Type | Editor |
|------|--------|
| text | Textarea replacing the value display |
| single | Dropdown/select with available values (existing + AI-suggested new) |
| multi | Tag toggles showing all available values, user can add/remove |
| palette | Dropdown/select with available palettes |
| scale | Small slider (0-10) |
| toggle | Switch |
| color | Text input for hex value |

### Props Change

The review dialog needs `attributeConfig: AttributeConfigJson` to look up available values for dropdowns and tag toggles. Passed from `LeftSidebar`.

### State

- `editingIndex: number | null` — which row is expanded for editing (null = none)
- `editedSuggestions: AiFillSuggestion[]` — local copy of suggestions with user edits applied. Initialized from props, updated on edits. Apply sends this instead of the original suggestions.

### Component Structure

- `AiFillReviewDialog` — main dialog, manages editing state
- `SuggestionRow` — display mode for a suggestion (existing)
- `SuggestionEditor` — edit mode for a suggestion, renders type-appropriate input

If the file grows beyond ~300 lines, extract `SuggestionEditor` to `src/components/editor/ai-fill-suggestion-editor.tsx`.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/ai-fill.ts` | Rewrite `SYSTEM_PROMPT` constant |
| `src/components/editor/ai-fill-review-dialog.tsx` | Add inline editing, `editingIndex` state, `editedSuggestions` state, `SuggestionEditor` sub-component, accept `attributeConfig` prop |
| `src/components/editor/left-sidebar.tsx` | Pass `attributeConfig` to `AiFillReviewDialog` |

No new files, no API changes, no credit changes.
