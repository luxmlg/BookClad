# Free Tier Model Restriction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict free users to the Quick model only, locking Detailed and Premium behind paid tiers (STARTER+).

**Architecture:** Add `requiredTier` to `AI_MODELS`, a `TIER_ORDER` constant, and an `isModelAvailable()` helper in `src/lib/constants.ts`. API routes check tier before reserving credits. The toolbar disables locked models with a lock icon and tooltip.

**Tech Stack:** Next.js API routes, Prisma (User.tier), React (InpaintToolbar)

---

### Task 1: Add tier gating constants and helper

**Files:**
- Modify: `src/lib/constants.ts:64-103`

- [ ] **Step 1: Add `TIER_ORDER` constant and `requiredTier` to `AI_MODELS`**

After `TIER_CREDITS` (line 68), add:

```typescript
export const TIER_ORDER: Record<string, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
};

export function isModelAvailable(modelValue: string, userTier: string): boolean {
  const model = AI_MODELS.find((m) => m.value === modelValue);
  if (!model) return false;
  return (TIER_ORDER[userTier] ?? 0) >= (TIER_ORDER[model.requiredTier] ?? 0);
}
```

Add `requiredTier` to each `AI_MODELS` entry:
- `quick`: `requiredTier: "FREE"`
- `detailed`: `requiredTier: "STARTER"`
- `premium`: `requiredTier: "STARTER"`

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add tier gating constants and isModelAvailable helper"
```

---

### Task 2: Add API tier enforcement to generation routes

**Files:**
- Modify: `src/app/api/generations/route.ts:36-57`
- Modify: `src/app/api/generations/[id]/extend/route.ts:32-50`

- [ ] **Step 1: Add tier check to `POST /api/generations`**

After the project ownership check (line 42) and before `calculateCreditCost` (line 56), add:

```typescript
import { AI_MODELS, isModelAvailable } from "@/lib/constants";
// (add to existing import from constants)

const user = await prisma.user.findUniqueOrThrow({
  where: { id: session.user.id },
  select: { tier: true },
});

if (!isModelAvailable(model, user.tier)) {
  const modelLabel = AI_MODELS.find((m) => m.value === model)?.label ?? model;
  return NextResponse.json(
    { error: `Upgrade to Starter to use the ${modelLabel} model` },
    { status: 403 },
  );
}
```

- [ ] **Step 2: Add tier check to `POST /api/generations/[id]/extend`**

The extend route reuses the generation's existing `model` (line 40: `model: true`). After the generation lookup (line 47) and status checks, add:

```typescript
import { AI_MODELS, isModelAvailable } from "@/lib/constants";
// (add to existing import from constants)

const user = await prisma.user.findUniqueOrThrow({
  where: { id: session.user.id },
  select: { tier: true },
});

if (!isModelAvailable(generation.model, user.tier)) {
  const modelLabel = AI_MODELS.find((m) => m.value === generation.model)?.label ?? generation.model;
  return NextResponse.json(
    { error: `Upgrade to Starter to use the ${modelLabel} model` },
    { status: 403 },
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/generations/route.ts src/app/api/generations/\[id\]/extend/route.ts
git commit -m "feat: enforce tier-based model restriction in generation API routes"
```

---

### Task 3: Add lock UI to model selector in toolbar

**Files:**
- Modify: `src/components/editor/inpaint-toolbar.tsx:39-66,156-185`
- Modify: `src/components/editor/editor-shell.tsx:827-856`

- [ ] **Step 1: Add `tier` prop to `InpaintToolbar`**

In `InpaintToolbarProps` (line 39), add:
```typescript
tier: string;
```

In the destructured props (line 68), add `tier`.

- [ ] **Step 2: Pass `tier` from `EditorShell`**

In `editor-shell.tsx` where `InpaintToolbar` is rendered (line 827), add:
```typescript
tier={tier}
```

- [ ] **Step 3: Update model selector to show lock on restricted models**

Add `Lock` to the lucide-react imports. Import `isModelAvailable` from `@/lib/constants`.

Replace the `modelSelector` JSX (lines 156-185) with:

```tsx
const modelSelector = (
  <Select value={model} onValueChange={(v) => v && setModel(v)}>
    <SelectTrigger className="h-7 w-[130px] text-xs">
      <SelectValue>
        {AI_MODELS.find((m) => m.value === model)?.label ?? "Model"}
      </SelectValue>
    </SelectTrigger>
    <SelectContent alignItemWithTrigger={false} className="min-w-52">
      {AI_MODELS.map((m) => {
        const locked = !isModelAvailable(m.value, tier);
        return (
          <SelectItem key={m.value} value={m.value} disabled={locked}>
            <HoverCard>
              <HoverCardTrigger
                render={<span />}
                className="underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 cursor-help"
              >
                {locked && <Lock className="mr-1 inline size-3 text-muted-foreground" />}
                {m.label}
              </HoverCardTrigger>
              <HoverCardContent side="right" className="text-sm">
                {locked
                  ? "Upgrade to Starter to unlock"
                  : m.description}
              </HoverCardContent>
            </HoverCard>{" "}
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Coins className="size-2.5 text-yellow-500" />
              {m.creditCost}/img
            </span>
          </SelectItem>
        );
      })}
    </SelectContent>
  </Select>
);
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/inpaint-toolbar.tsx src/components/editor/editor-shell.tsx
git commit -m "feat: show lock icon on restricted models in toolbar selector"
```

---

### Task 4: Auto-downgrade model if user's tier doesn't allow it

**Files:**
- Modify: `src/components/editor/use-generation-actions.ts`

- [ ] **Step 1: Clamp initial model to available tier**

The `useGenerationActions` hook initializes the model from `QUICK_CREATE_TIER_CONFIG` (line ~48). After setting the initial model, add a guard that ensures the model is available for the user's tier. If `tier` is not already a parameter of this hook, add it.

Find where `model` state is initialized and add:

```typescript
import { isModelAvailable, AI_MODELS } from "@/lib/constants";

// After model state initialization, add effect:
useEffect(() => {
  if (!isModelAvailable(model, tier)) {
    const available = AI_MODELS.filter((m) => isModelAvailable(m.value, tier));
    if (available.length > 0) setModel(available[available.length - 1].value);
  }
}, [tier]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Thread `tier` through**

If `useGenerationActions` doesn't already receive `tier`, add it as a parameter. Check where it's called in `editor-shell.tsx` and pass `tier`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/use-generation-actions.ts src/components/editor/editor-shell.tsx
git commit -m "feat: auto-downgrade model selection for restricted tiers"
```

---

### Task 5: Update pricing page

**Files:**
- Modify: `src/app/page.tsx:64-67`

- [ ] **Step 1: Add "Quick model only" to FREE tier features**

Change the FREE plan features array:
```typescript
features: [
  "20 credits / month",
  "Quick model only",
  "~4-6 covers depending on quality preset",
  "Full-res KDP export",
],
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/page.tsx
git commit -m "feat: add 'Quick model only' to free tier pricing"
```

---

### Verification

1. `npx tsc --noEmit` — clean build
2. Editor as free user — Detailed/Premium show lock icon, disabled, tooltip says "Upgrade to Starter to unlock"
3. Editor as free user — selecting Quick works normally, Generate fires
4. API — `POST /api/generations` with `model: "premium"` as free user → 403
5. Pricing page — FREE tier shows "Quick model only"
6. Editor as STARTER/PRO user — all models available, no lock icons
