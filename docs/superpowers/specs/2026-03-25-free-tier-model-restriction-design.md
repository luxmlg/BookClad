# Free Tier Model Restriction

## Goal
Restrict free users to the Quick model only, locking Detailed and Premium behind paid tiers. This incentivizes upgrades while still letting free users generate covers.

## Model Access Matrix

| Model | FREE | STARTER | PRO |
|-------|------|---------|-----|
| Quick (2 cr/img) | Yes | Yes | Yes |
| Detailed (3 cr/img) | Locked | Yes | Yes |
| Premium (5 cr/img) | Locked | Yes | Yes |

## Data Model

Add `requiredTier` to each entry in `AI_MODELS` (`src/lib/constants.ts`):
- `quick` → `"FREE"`
- `detailed` → `"STARTER"`
- `premium` → `"STARTER"`

Add a `TIER_ORDER` constant and an `isModelAvailable(model, userTier)` helper in `src/lib/constants.ts`:
```
TIER_ORDER: FREE=0, STARTER=1, PRO=2
isModelAvailable: TIER_ORDER[userTier] >= TIER_ORDER[requiredTier]
```

## API Enforcement

Both `POST /api/generations` and `POST /api/generations/[id]/extend` must check the user's tier (from `session.user` or a DB lookup) against the requested model's `requiredTier` before calling `reserveCredits()`. Return 403 with `"Upgrade to Starter to use the {label} model"` if the tier is insufficient.

## UI Changes

### Model Selector (inpaint-toolbar.tsx)
- Pass `tier` prop from `EditorShell` → `InpaintToolbar`
- For each model in the selector, check `isModelAvailable(model.value, tier)`
- Locked models: render as disabled, show a `Lock` icon next to the label, tooltip `"Upgrade to Starter to unlock"`
- The hover card description still renders so users can see what they're missing
- If the user's current `model` state is a locked model (e.g., they were previously on a paid tier), auto-downgrade to the highest available model on load

### Quick Create (quick-create-form.tsx)
- Already uses `QUICK_CREATE_TIER_CONFIG` which maps FREE → quick. No change needed.

### Pricing Page (src/app/page.tsx)
- Add `"Quick model only"` to the FREE tier features list
- STARTER/PRO features already say "All AI models" in the billing tab

### Billing Tab (src/app/settings/billing-tab.tsx)
- No change needed — STARTER/PRO already list "All AI models"

## Files to Modify
- `src/lib/constants.ts` — `AI_MODELS` entries, `TIER_ORDER`, `isModelAvailable()`
- `src/app/api/generations/route.ts` — tier check before `reserveCredits()`
- `src/app/api/generations/[id]/extend/route.ts` — same tier check
- `src/components/editor/inpaint-toolbar.tsx` — disabled state, lock icon, tooltip
- `src/components/editor/editor-shell.tsx` — pass `tier` to `InpaintToolbar`
- `src/app/page.tsx` — add "Quick model only" to FREE features
