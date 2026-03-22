# AI Attribute Generation ("AI Fill")

## Overview

Add an AI-powered attribute generation feature to the editor sidebar. Users click "AI Fill" next to the existing "Add Attribute" button, type a direction (e.g. "make it a dark horror novel set in an asylum"), and the AI suggests attribute changes — filling existing attributes, creating new values, and proposing new attributes entirely. Users review suggestions in a checklist dialog before applying.

## User Flow

1. User clicks **"AI Fill"** button next to "Add Attribute" in the left sidebar
2. A **popover** opens anchored to the button with:
   - Textarea for the user's direction
   - "Generate (1 credit)" button (disabled if insufficient balance)
3. User types their direction and clicks Generate
4. Loading state in the popover (~2-3 seconds)
5. Popover closes, **checklist dialog** opens with all suggestions:
   - **Updated attributes**: shows old → new value, each with a toggle checkbox
   - **New attributes**: marked with a "NEW" badge, also toggleable
6. User unchecks anything they don't want, then:
   - **Apply Selected** — updates attributes and closes
   - **Regenerate** — costs another credit, re-opens popover with same prompt
   - **Cancel** — discards suggestions
7. Applied changes update the sidebar attributes immediately

## Architecture

### Approach: Synchronous API route in Next.js

This is a fast text-only Gemini call (~2-3 seconds), not image generation. No need for BullMQ queues, WebSocket progress, or worker involvement. A simple request-response API route handles everything.

### API Endpoint

`POST /api/attributes/generate`

**Request:**
```typescript
{
  projectId: string;   // look up current attribute selections
  prompt: string;      // user's direction (max 1000 characters)
}
```

Validated via Zod schema in `src/lib/validations.ts`: `aiFillSchema` with `projectId` as `z.string().cuid2()` and `prompt` as `z.string().min(1).max(1000)`.

**Server-side flow:**
1. Auth check (`session.user.id`)
2. Validate request body with Zod
3. Fetch user's full `AttributeConfig` — every attribute with name, type, description, all values with labels and descriptions, scale labels, palette colors
4. Fetch project's current `AttributeSelection`
5. Deduct 1 credit via `reserveAiFillCredits(userId)`
6. Build Gemini prompt (system instructions + full attribute context + current selections + user direction)
7. Call Gemini `gemini-2.5-flash` with thinking enabled for structured JSON output
8. Validate Gemini response against a Zod schema to handle malformed output gracefully
9. Return suggestions

**Response:**
```typescript
{
  suggestions: AiFillSuggestion[];
}

interface AiFillSuggestion {
  attributeId: string | null;       // null for brand new attributes
  name: string;                     // attribute name
  type: AttributeType;              // "single" | "multi" | "text" | "toggle" | "scale" | "color" | "palette"
  value: string | string[];         // suggested value(s)
  previousValue?: string | string[];  // for diff display on existing attributes
  isNew: boolean;                   // true if this is an entirely new attribute
  // New values to add to existing attributes (e.g. adding "noir" to Mood)
  newValues?: { value: string; label: string; description?: string; colors?: string[] }[];
  // Full definition for brand new attributes
  newAttribute?: {
    name: string;
    type: AttributeType;
    description: string;
    values?: { value: string; label: string; description?: string; colors?: string[] }[];
    scaleLabels?: { min: string; max: string };
  };
}
```

### AI Capabilities

The AI can:
- **Pick existing values** for existing attributes (e.g. Genre → "thriller")
- **Create new values** for existing attributes (e.g. add "noir" to Mood with a label and description)
- **Suggest entirely new attributes** with full definitions (name, type, description, values)

## Gemini Prompt Design

Three parts:

### 1. System Instructions

Tells the AI it is a book cover attribute advisor. Explains attribute types and their semantics:
- `single`: pick one value from a dropdown
- `multi`: pick multiple values as tags
- `text`: free-form textarea content
- `toggle`: on/off switch (stores "true"/"false")
- `scale`: slider 0-10 with optional endpoint labels
- `color`: hex color value
- `palette`: curated color set

Instructs it to return structured JSON matching the response schema. Tells it to only suggest changes that are relevant to the user's direction — don't change attributes that don't need changing.

### 2. Full Attribute Context

The user's complete `AttributeConfig` serialized with all context:

```
Available attributes:

Genre (single): Choose the book's genre
  Values: thriller ("Fast-paced suspense and danger"), romance ("Love and relationships"), ...
  Currently selected: "epic-fantasy"

Mood (multi): The emotional tone of the cover
  Values: dark ("Shadows, mystery, foreboding"), whimsical ("Playful, light-hearted"), ...
  Currently selected: ["dark", "epic"]

Visual Elements (text): Specific objects or symbols to include in the cover
  Currently set to: "A couple with magical powers standing on a cliff..."
```

Every attribute, every value, every description — so the AI understands the full vocabulary and can make informed choices about what exists vs what to create.

### 3. User's Direction

The prompt they typed, passed as-is.

### Model

`gemini-2.5-flash` with thinking enabled. This is a text-only structured output call — no image generation. Flash is fast (~2-3s) and cheap (~$0.016/call).

## Client-Side Components

### `AiFillPopover`

Location: `src/components/editor/ai-fill-popover.tsx`

- Anchored to the AI Fill button in the left sidebar
- Contains:
  - Textarea for user's direction
  - "Generate (1 credit)" button
  - Credit balance check — button disabled with tooltip if insufficient
  - Loading spinner during API call
- On success: closes popover, opens `AiFillReviewDialog` with suggestions
- On error: shows error toast
- Prompt stored in parent state (`LeftSidebar`) so Regenerate can pre-fill it
- Max 1000 characters enforced in the textarea

### `AiFillReviewDialog`

Location: `src/components/editor/ai-fill-review-dialog.tsx`

- Receives `AiFillSuggestion[]` from the API response
- Groups suggestions into:
  - **Updated attributes** — existing attributes with changed values
  - **New attributes suggested** — brand new attributes with "NEW" badge
- Each suggestion row shows:
  - Checkbox (all checked by default)
  - Attribute name and type
  - Suggested value(s)
  - "was: X" diff for changed attributes
  - "NEW" badge for new attributes and new values
- Footer buttons:
  - **Cancel** — discard all suggestions
  - **Regenerate** — costs 1 more credit, closes dialog, re-opens popover with same prompt pre-filled (prompt state lives in `LeftSidebar`)
  - **Apply Selected** — applies only checked suggestions

### Integration with EditorShell

The apply callback does three things:
1. Updates `attributes` (selections) for changed existing attributes
2. Calls `onConfigChange` to add new values to existing attributes
3. Calls `onConfigChange` to add new attributes to the config, then updates selections

### Left Sidebar Changes

- Add "AI Fill" button next to "Add Attribute" button at the bottom of the sidebar
- Both buttons in a flex row with equal width
- AI Fill button has purple accent styling to distinguish it

## Credit Integration

- **Cost**: 1 credit per AI Fill generation
- **New helper**: `reserveAiFillCredits(userId)` in `src/lib/credits.ts`
  - Atomic Prisma transaction: check balance, decrement by 1, create `CreditTransaction(RESERVE)` with description "AI attribute generation"
  - `generationId` is `null` — this is intentional since AI Fill has no `Generation` record. The `generationId` field on `CreditTransaction` is already optional.
  - Throws `InsufficientCreditsError` if balance < 1
- **No refund on failure** — 1 credit is too small to justify refund complexity. If the Gemini call fails after credit deduction, the credit is lost. This is an intentional trade-off: refund logic adds complexity that isn't worth it for 1 credit.
- **Client**: checks `useCreditStore` balance to disable button when insufficient
- **Post-apply**: calls `refreshCredits()` to update navbar badge

### Cost Analysis

- API cost per call: ~$0.016 (1,900 input tokens @ $2/1M + 1,000 output tokens @ $12/1M)
- Revenue per call: $0.08–0.10 (1 credit)
- Margin: ~80%

## Constants

- `AI_FILL_CREDIT_COST = 1` in `src/lib/constants.ts`
- `AI_FILL_PROMPT_MAX_LENGTH = 1000` in `src/lib/constants.ts`
- Gemini model for AI Fill: `gemini-2.5-flash` (reuse existing `GEMINI_API_KEY` env var — must be available to the Next.js process at runtime, not just the worker)

## Files to Create

- `src/app/api/attributes/generate/route.ts` — API endpoint
- `src/components/editor/ai-fill-popover.tsx` — popover with textarea
- `src/components/editor/ai-fill-review-dialog.tsx` — checklist review dialog
- `src/lib/ai-fill.ts` — prompt building and Gemini call logic

## Files to Modify

- `src/components/editor/left-sidebar.tsx` — add AI Fill button, manage popover/dialog/prompt state
- `src/lib/credits.ts` — add `reserveAiFillCredits()`
- `src/lib/constants.ts` — add `AI_FILL_CREDIT_COST`, `AI_FILL_PROMPT_MAX_LENGTH`
- `src/lib/validations.ts` — add `aiFillSchema` Zod schema
