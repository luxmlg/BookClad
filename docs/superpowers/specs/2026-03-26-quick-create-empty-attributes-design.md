# Fix: Quick Create Saves Empty Attributes

## Problem

Quick Create seeds the AI Fill selection with `buildDefaultSelection(config)`, which creates default values for **every enabled attribute** (empty strings, empty arrays, `"false"`, `"5"`, etc.). The AI only returns suggestions for attributes it deems relevant, but `applySuggestions()` starts from the full seed — so attributes the AI didn't touch remain in the final selection with meaningless default values.

This causes:
- Clutter in the editor sidebar (empty attributes visible)
- Noise in the Gemini prompt (empty attributes sent to the worker's prompt builder)

## Root Cause

`src/app/api/projects/quick-create/route.ts:100`:

```ts
const seedSelection: AttributeSelection = buildDefaultSelection(config);
seedSelection.genre = genre;
```

`buildDefaultSelection()` creates a default value for every enabled attribute. `applySuggestions()` copies this full seed and only overwrites attributes the AI returned suggestions for. Everything else stays.

## Fix

Replace the seed with a minimal selection containing only the user-chosen genre:

```ts
const seedSelection: AttributeSelection = { genre };
```

The AI still sees the full attribute config (via `serializeAttributeConfig`), still decides what's relevant, and `applySuggestions()` only adds attributes the AI explicitly suggests. Attributes it doesn't mention won't exist in the selection.

The AI Fill prompt already instructs: *"NEVER return an empty value. Only suggest attributes you are setting a value for."* — so the AI side requires no changes.

## Scope

- **Changed**: `src/app/api/projects/quick-create/route.ts` — one line
- **Not changed**: Editor AI Fill (base is the project's existing selection, not `buildDefaultSelection`), Brief Wizard (needs all attributes for the manual UI)

## Impact

- New projects created via Quick Create will only have attributes the AI explicitly set
- Existing projects with empty attributes are unaffected (no migration)
- No changes to AI Fill prompt, `applySuggestions()`, or `buildDefaultSelection()`
