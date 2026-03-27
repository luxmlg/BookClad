# AI Edit Attributes in Settings

**Date:** 2026-03-26

## Problem

Users can only modify their attribute config manually in the Settings → Attributes tab (add/remove attributes, add/remove values, toggle enabled, edit descriptions). There's no way to make bulk structural changes via natural language. Additionally, built-in attributes cannot be deleted — only toggled off — which clutters the config for users who don't need them.

## Solution

Add an "AI Edit" feature to the Attributes tab that lets users describe config changes in natural language. Gemini returns a modified config, the client diffs it against the current config, and the user reviews/applies individual changes. Also allow hard-deleting built-in attributes and restoring them later.

## Decisions

- **Cost:** 1 credit per AI Edit call, including Regenerate (same as editor AI Fill). Credits are not refunded on Gemini failure — consistent with AI Fill behavior.
- **Diff style:** Inline before/after in a review dialog with checkboxes (same pattern as AI Fill Review)
- **Built-in deletion:** Hard delete, same as custom attributes. Recovery via "Restore Built-in Attributes".
- **Restore:** Additive only — adds back missing built-in attributes/values without touching custom ones
- **Approach:** AI Edit button in the Attributes tab header, popover + review dialog pattern
- **Empty config:** At least one attribute must remain. The review dialog disables Apply if the resulting config would have zero attributes.
- **Rate limiting:** No app-level rate limit — 429 is only forwarded from Gemini.

## UI Changes

### Attributes Tab Header

Add "AI Edit" button (purple, sparkle icon) next to the existing "Add Attribute" button. Clicking opens a popover with:
- Textarea for natural language instruction (max 1000 chars, reuses `AI_FILL_PROMPT_MAX_LENGTH`)
- Credit indicator (1 credit, same as AI Fill popover)
- Submit button, disabled when empty or loading

### Built-in Attribute Deletion

Remove the `!attribute.builtIn` guard on the delete button in `attributes-tab.tsx`. All attributes get the same delete behavior — removed from the config array entirely.

### Restore Built-in Attributes

Button in the Attributes tab footer. Calls `ensureBuiltInAttributes(config)` to add back any missing built-in attributes and values without touching custom ones. Shows a toast on completion.

### AI Edit Review Dialog

New `AiEditReviewDialog` component. Each change is a row with:
- Checkbox to include/exclude
- Change description (e.g., "Add attribute: Lighting (single)")
- Inline before/after for modifications (old value struck through, new value shown)
- Changes grouped by attribute for readability
- Footer: Cancel, Regenerate (re-run with same prompt, costs 1 credit — shown in button), Apply (N) button
- Apply disabled if selected changes would result in zero attributes

## API

### `POST /api/attributes/edit`

**Request:**
```ts
{ prompt: string }
```

**Flow:**
1. Auth check
2. Fetch user's current `AttributeConfigJson` from DB
3. Reserve 1 credit via `reserveAiFillCredits()`
4. Serialize config structure to Gemini — attribute definitions only (id, name, type, description, enabled, values with their labels/descriptions/colors, scaleLabels). No project-scoped selections since this operates on the global config. Preserve `briefPosition` from original config — do not send to Gemini or expect it back.
5. Send to Gemini 2.5 Flash with structured JSON output
6. Validate response shape
7. Return `{ before: AttributeConfigJson, after: AttributeConfigJson }` to client. The `before` config carries over `briefPosition` from the DB; the `after` config also inherits `briefPosition` from the original.

**Errors:** 401 (unauth), 403 (insufficient credits), 429 (forwarded from Gemini), 500 (Gemini failure)

## System Prompt

Focused on config structure operations. Key instructions:
- Explains all 7 attribute types with constraints (palette needs exactly 5 hex colors, scale has optional min/max labels)
- Can add, remove, and modify attributes and their values
- Can change attribute types, descriptions, enabled state
- Must set `builtIn: false` on all new attributes and values
- Must preserve existing `builtIn` flags on unmodified attributes/values
- Must preserve attributes/values not mentioned by the user — do not drop or reorder them
- Returns the complete `AttributeConfigJson` (the `attributes` array), not a partial diff
- Must not return fewer than 1 attribute

## Diff Engine

### `diffAttributeConfigs(before, after)` — `src/lib/attribute-diff.ts`

Pure function that compares two `AttributeConfigJson` objects and returns a list of structured changes:

```ts
type ConfigChange =
  | { type: "add-attribute"; attribute: Attribute }
  | { type: "remove-attribute"; attribute: Attribute }
  | { type: "modify-attribute"; attributeId: string; field: string; before: string; after: string }
  | { type: "add-value"; attributeId: string; value: AttributeValue }
  | { type: "remove-value"; attributeId: string; value: AttributeValue }
  | { type: "modify-value"; attributeId: string; valueBefore: AttributeValue; valueAfter: AttributeValue }
```

Compares by attribute `id` for matching. Detects:
- Added attributes (in `after` but not `before`)
- Removed attributes (in `before` but not `after`)
- Modified attribute fields — each changed field (name, type, description, enabled) emits a separate `modify-attribute` entry so users can accept/reject individually
- Added/removed/modified values within matching attributes (matched by `value` slug)

Preserves original attribute ordering. New attributes are appended at the end.

### `applyConfigChanges(currentConfig, selectedChanges)` — same file

Pure function that applies only the selected changes from the changelist to produce the final config. Preserves original attribute ordering; appends new attributes at the end.

## Files to Create

- `src/app/api/attributes/edit/route.ts` — API endpoint
- `src/lib/attribute-diff.ts` — diff engine and apply logic
- `src/app/settings/ai-edit-popover.tsx` — popover with textarea
- `src/app/settings/ai-edit-review-dialog.tsx` — review dialog with inline diffs

## Files to Modify

- `src/app/settings/attributes-tab.tsx` — add AI Edit button, remove built-in delete guard, add Restore button
- `src/lib/ai-fill.ts` — extract/reuse the Gemini call pattern (or keep separate if the prompt differs enough)
- `src/lib/validations.ts` — add validation schema for the edit endpoint request body
