# Quick Create — Design Spec

## Overview

Replace the default cover creation flow with a simplified "Quick Create" form that asks only for book title, author name, genre, and a free-text description. The system uses AI Fill to generate attributes server-side and immediately queues a tier-appropriate generation — no manual attribute configuration required.

The existing 4-step wizard is preserved as an "Advanced" option accessible via a text link.

## Decisions

- **Two paths**: Quick Create (default) + Advanced wizard (text link below submit button)
- **Form fields**: Title (required), Author (required), Genre dropdown (required), Description textarea (required)
- **Tier-based generation**: FREE = 4 quick images, STARTER = 8 detailed images, PRO = 8 premium images
- **AI attributes**: Generated server-side via existing `generateAttributeSuggestions()`, invisible to user
- **Loading UX**: Button spinner on /create ("Creating your covers...") → redirect to /editor/[id]
- **Description storage**: Saved to `CoverProject.description` column, not displayed in UI
- **Advanced wizard**: Retains full control — user-selectable model (quick/detailed/premium) and image count (1-8)

## Database Changes

Add nullable `description` column to `CoverProject`:

```prisma
model CoverProject {
  id          String   @id @default(cuid())
  userId      String
  title       String
  author      String
  description String?          // new — stores Quick Create description
  attributes  Json
  canvasState Json?
  // ... rest unchanged
}
```

Both app and worker Prisma schemas must be updated and regenerated.

## API Endpoint: `POST /api/projects/quick-create`

### Request Body

```typescript
{
  title: string;        // required, max 200
  author: string;       // required, max 200
  genre: string;        // required, one of the 12 built-in genre values
  description: string;  // required, free-text cover description
}
```

### Server-Side Flow

1. Auth check → 401 if no session
2. Validate body with Zod schema
3. Look up user's tier → determine model + imageCount from `QUICK_CREATE_TIER_CONFIG`
4. Reserve 1 credit for AI Fill (`AI_FILL_CREDIT_COST`)
5. Fetch user's `AttributeConfig` (or build default if none exists)
6. Build seed selection with the chosen genre pre-set
7. Call `generateAttributeSuggestions(config, seedSelection, description)`
8. Call `applySuggestions(config, seedSelection, suggestions)` → final config + attributes
9. Save updated `AttributeConfig` to DB
10. Create `CoverProject` with title, author, description, and generated attributes
11. Call `reserveCredits()` with tier-appropriate model and imageCount
12. Add job to BullMQ queue (`JOB_TYPE.GENERATE`)
13. Return `{ projectId, generationId }` with 202

### Tier Configuration Constant

```typescript
const QUICK_CREATE_TIER_CONFIG = {
  FREE:    { model: "quick",   imageCount: 4 },
  STARTER: { model: "detailed", imageCount: 8 },
  PRO:     { model: "premium", imageCount: 8 },
} as const;
```

### Error Responses

- 401 — not authenticated
- 400 — validation error
- 403 — insufficient credits (includes `required` and `available`)
- 500 — AI Fill or internal error

### Credit Costs Per Quick Create

| Tier | AI Fill | Generation | Total |
|------|---------|------------|-------|
| FREE | 1 | 4 × 2 = 8 | **9** |
| STARTER | 1 | 8 × 3 = 24 | **25** |
| PRO | 1 | 8 × 5 = 40 | **41** |

## Shared Utility: `applySuggestions()`

Extract the suggestion-applying logic from `handleApplyAiFill` in `left-sidebar.tsx` into a pure function in `src/lib/ai-fill.ts`:

```typescript
export function applySuggestions(
  config: AttributeConfigJson,
  baseSelection: AttributeSelection,
  suggestions: AiFillSuggestion[]
): { config: AttributeConfigJson; selection: AttributeSelection }
```

Handles three cases:
- **New attributes**: Creates attribute from `newAttribute` definition, checks ID collision via `slugify`
- **New values on existing attributes**: Deduplicates via `addValueToAttribute()`
- **Value updates**: Sets the suggestion's value on the selection

Both `left-sidebar.tsx` and the quick-create API route call this utility. `left-sidebar.tsx` is refactored to use it instead of inlining the logic.

## Client Component: `QuickCreateForm`

**File**: `src/components/wizard/quick-create-form.tsx`

### Form Fields
- Book Title — text input, required
- Author Name — text input, required
- Genre — combobox/select using existing genre values, required
- Description — textarea, required

### Submit Behavior
1. Validate all fields client-side
2. Set button to loading state ("Creating your covers...")
3. `POST /api/projects/quick-create` with form data
4. On success → `router.push(/editor/${projectId})`
5. On 403 → show inline error with credit balance and required cost
6. On other errors → show inline error

### Credit Cost Display
Below the submit button, show the cost: e.g., "This will use 9 credits (4 quick images)". Derived from user's tier, passed as prop from server component.

### Advanced Link
Below the credit display: "or customize attributes manually →" — toggles state to show `BriefWizard`.

## Page Routing: `/create`

No new routes. The `/create` page renders both paths toggled by client state:

- **Default**: `QuickCreateForm`
- **"customize attributes manually →"**: Swaps to `BriefWizard` (existing wizard, unchanged, with model picker + image count slider)
- **"← Back to Quick Create"**: Link at top of wizard to swap back

Server component passes user's tier to the client for credit cost display.

## What Does NOT Change

- **BriefWizard** — untouched, just wrapped in the toggle
- **Editor** — no changes
- **Worker** — no changes
- **`POST /api/generations`** — existing endpoint stays as-is for editor use
- **AI Fill in editor** — stays as-is
- **Generation history/diffs** — works automatically since we set `attributeSnapshot` via existing `reserveCredits` flow
