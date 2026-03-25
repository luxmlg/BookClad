# Credit System Overhaul — Design Spec

**Date**: 2026-03-26
**Status**: Approved

## Overview

Overhaul BookClad's credit/pricing system: swap Quick mode model, update credit costs, introduce credit pools with expiry, add Studio tier and Mega credit pack, implement priority queue for Pro/Studio, and reposition Quick as a prototyping-only mode (no upscale, no KDP export).

## Decisions

- Payment provider: DodoPayments (no migration)
- Credit architecture: CreditPool model with priority-based spend order (Approach A)
- Pool sorting: `priority` integer field on CreditPool (option C)
- Watermarks: out of scope
- Mode access: unchanged (tier-based — Detailed/Premium require STARTER+)
- Feature restrictions: priority queue for Pro/Studio only. No max_covers limit, no bulk_export, no api_access.
- Free signup credits: 15 (new signups only, app not live yet)
- Premium thinking config: unchanged (no explicit thinking config, model handles internally)

---

## 0. Schema & Cleanup Prerequisites

### Prisma Tier Enum

Both `prisma/schema.prisma` and `worker/prisma/schema.prisma` define a `Tier` enum with values `FREE`, `STARTER`, `PRO`. Add `STUDIO` to both. This requires a Postgres `ALTER TYPE` migration.

### Stale Defaults and Fallbacks

- `Generation.model` has `@default("openai")` in the Prisma schema — update to `@default("quick")`
- `calculateCreditCost()` in `src/lib/credits.ts` has a fallback `?? CREDIT_COST_PER_IMAGE.openai` — remove the `openai` fallback, use `CREDIT_COST_PER_IMAGE.quick` as default
- Remove any remaining references to `"openai"` as a model value

### Type Updates

- `tierFromProductId()` return type: `"STARTER" | "PRO" | null` → `"STARTER" | "PRO" | "STUDIO" | null`
- Checkout route Zod schema: `z.enum(["STARTER", "PRO"])` → `z.enum(["STARTER", "PRO", "STUDIO"])`
- `AI_MODELS` entries gain `exportable: boolean` field — update the inferred type accordingly

---

## 1. Model & Generation Config Changes

### Quick Mode — Prototyping Only

- Model swap: `gemini-2.5-flash-image` → `gemini-3.1-flash-image-preview`
- Config: `{ aspectRatio: "9:16", imageSize: "1K" }`, no thinking
- Pipeline: Generate → **upload raw** (no upscale, no KDP crop)
- Export: Quick images **excluded** from KDP export
- UI messaging: *"Low-cost drafts for exploring ideas and styles. Not export-ready — upgrade to Detailed or Premium for KDP-ready covers."*
- Remove all references to `gemini-2.5-flash-image` from codebase

### Detailed & Premium — Unchanged Pipeline

- Generate at 4K → skip upscale (already exceeds KDP) → crop to 1600x2560 → upload
- Full KDP export support

### Updated Constants

**`GEMINI_MODEL_IDS`** (worker):
```
quick:    "gemini-3.1-flash-image-preview"  (was gemini-2.5-flash-image)
detailed: "gemini-3.1-flash-image-preview"  (unchanged)
premium:  "gemini-3-pro-image-preview"      (unchanged)
```

**`GEMINI_MODEL_CONFIG`** (worker):
```
quick:    { aspectRatio: "9:16", imageSize: "1K" }
detailed: { aspectRatio: "9:16", imageSize: "4K", thinkingLevel: "High" }
premium:  { aspectRatio: "9:16", imageSize: "4K" }
```

**`CREDIT_COST_PER_IMAGE`** (both app and worker):
```
quick:    2  (unchanged)
detailed: 4  (was 3)
premium:  6  (was 5)
```

**`AI_MODELS` Quick entry**:
```typescript
{
  value: "quick",
  label: "Quick",
  description: "Low-cost drafts for exploring ideas and styles. Not export-ready — upgrade to Detailed or Premium for KDP-ready covers.",
  capabilities: [GENERATE, INPAINT],
  creditCost: 2,
  requiredTier: "FREE",
  exportable: false,  // new field
}
```

Detailed and Premium gain `exportable: true`.

### Quick Image Dimensions

Quick outputs at 1K with 9:16 aspect ratio — actual pixel dimensions are determined by Gemini (likely ~576x1024 or similar). The processor must read dimensions from the image buffer via Sharp metadata and store them on the `GeneratedImage` row, rather than hardcoding `KDP.width`/`KDP.height`.

### Pipeline Branching

The generation processor branches on `job.data.model === "quick"` to skip upscale and KDP crop. Quick and Detailed share the same Gemini model ID but differ by config — the processor already dispatches based on the `model` field (e.g., `"quick"`, `"detailed"`), not the Gemini model ID.

### Export Gating

- Export API (`POST /api/projects/[id]/export`) exports a single selected image — check if that image's generation used the `"quick"` model. If so, return 400.
- Export button in RightSidebar disabled for Quick images with tooltip: *"Quick images are drafts — generate with Detailed or Premium for KDP-ready export"*

---

## 2. Credit Pool Architecture

### New CreditPool Model

```prisma
model CreditPool {
  id             String    @id @default(cuid())
  userId         String
  source         String    // "SUBSCRIPTION" | "PURCHASE" | "SIGNUP_GRANT" | "REFUND"
  originalAmount Int
  remaining      Int
  priority       Int       // 0 = SUBSCRIPTION (spend first), 1 = others
  expiresAt      DateTime?
  createdAt      DateTime  @default(now())
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, priority, createdAt])
}
```

### Expiry Rules

| Source | Expiry |
|--------|--------|
| SUBSCRIPTION | `currentPeriodEnd` from webhook. No rollover. |
| PURCHASE | 12 months from purchase date |
| SIGNUP_GRANT | Never (`expiresAt: null`) |
| REFUND | Never (`expiresAt: null`) |

### Spend Logic

Priority order: SUBSCRIPTION pools first (priority=0), then oldest PURCHASE/SIGNUP_GRANT/REFUND pools by `createdAt` (priority=1).

**Concurrency safety**: Prisma's default `READ COMMITTED` isolation allows two concurrent transactions to read the same pool and both decrement, causing `remaining` to go negative. To prevent this, each pool update uses `updateMany` with a `remaining >= take` guard — if the guard fails (another transaction drained it), re-fetch and retry.

```typescript
async function spendCredits(tx, userId: string, amount: number): Promise<void> {
  // Lock the user row first to serialize concurrent spends
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

  const pools = await tx.creditPool.findMany({
    where: {
      userId,
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [
      { priority: "asc" },    // SUBSCRIPTION (0) first
      { createdAt: "asc" },   // FIFO within same priority
    ],
  });

  let remaining = amount;

  for (const pool of pools) {
    if (remaining <= 0) break;
    const take = Math.min(pool.remaining, remaining);
    await tx.creditPool.update({
      where: { id: pool.id },
      data: { remaining: { decrement: take } },
    });
    remaining -= take;
  }

  if (remaining > 0) throw new InsufficientCreditsError(amount, amount - remaining);

  await tx.user.update({
    where: { id: userId },
    data: { creditBalance: { decrement: amount } },
  });
}
```

### All Reserve Functions Use spendCredits

`reserveCredits`, `reserveExtensionCredits`, and `reserveAiFillCredits` all call `spendCredits(tx, userId, amount)` inside their existing `$transaction` block. `reserveAiFillCredits` has no `generationId` — its `CreditTransaction` continues to use `generationId: null` as it does today.

### Refund Logic

On generation failure, create a new REFUND pool (no expiry, priority=1). Does not attempt to credit back to original pools.

```typescript
async function refundCredits(tx, userId, generationId, amount) {
  await tx.creditPool.create({
    data: {
      userId,
      source: "REFUND",
      originalAmount: amount,
      remaining: amount,
      expiresAt: null,
      priority: 1,
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: { creditBalance: { increment: amount } },
  });

  await tx.creditTransaction.create({ /* REFUND record */ });
}
```

### Grant Logic

Each grant creates a new CreditPool row:
- `grantCredits()` updated to accept source and expiresAt
- Signup: `source: "SIGNUP_GRANT"`, `expiresAt: null`, `priority: 1`
- Subscription renewal: `source: "SUBSCRIPTION"`, `expiresAt: currentPeriodEnd`, `priority: 0`
- Credit pack purchase: `source: "PURCHASE"`, `expiresAt: 12 months from now`, `priority: 1`

### Expiry Sweep

Worker startup sweep (similar to stale generation cleanup) + **hourly periodic check** via `setInterval`:
1. Find pools where `expiresAt < now()` and `remaining > 0`
2. For each expired pool, in a single transaction:
   - Set `remaining = 0`
   - Decrement `User.creditBalance` by the expired amount
   - Create `CreditTransaction(EXPIRE)` record

### Subscription Renewal Flow

All steps in a **single Prisma transaction** to prevent races:
1. `subscription.renewed` webhook fires
2. Find and zero out remaining on old SUBSCRIPTION pools for this user (no rollover)
3. Create new SUBSCRIPTION pool: `remaining = TIER_CREDITS[tier]`, `expiresAt = currentPeriodEnd`, `priority = 0`
4. Update `creditBalance`: decrement old remaining, increment new grant
5. Create `CreditTransaction(GRANT)`

### Subscription Plan Change Flow

When `subscription.plan_changed` webhook fires (e.g., PRO → STUDIO), in a **single transaction**:
1. Zero out remaining on old SUBSCRIPTION pools
2. Create new SUBSCRIPTION pool with full `TIER_CREDITS[newTier]`, `expiresAt = currentPeriodEnd`
3. Update `creditBalance`: decrement old remaining, increment new grant
4. Create `CreditTransaction(GRANT)` with description noting the plan change

### Denormalized Balance

`User.creditBalance` stays as a cached total for fast reads (navbar, generate button checks). Always updated atomically alongside pool changes. `CreditTransaction` stays as the audit log.

---

## 3. Subscription Tiers & Credit Packs

### Updated Constants

**`TIER_CREDITS`:**
```
FREE:    15  (was 20)
STARTER: 100
PRO:     250
STUDIO:  500  (new)
```

**`TIER_ORDER`:**
```
FREE:    0
STARTER: 1
PRO:     2
STUDIO:  3
```

**`PLAN_PRICES`:**
```
STARTER: 9
PRO:     19
STUDIO:  35  (new)
```

**`CREDIT_PACKS`:**
```
{ id: "CREDITS_50",  credits: 50,  price: 5  }
{ id: "CREDITS_100", credits: 100, price: 9  }
{ id: "CREDITS_250", credits: 250, price: 20 }
{ id: "CREDITS_500", credits: 500, price: 35 }  (new)
```

**`QUICK_CREATE_TIER_CONFIG`:**
```
FREE:    { model: "quick",    imageCount: 4 }
STARTER: { model: "detailed", imageCount: 8 }
PRO:     { model: "detailed", imageCount: 8 }
STUDIO:  { model: "detailed", imageCount: 8 }  (new)
```

### DodoPayments Changes

- New env vars: `DODO_PRODUCT_ID_STUDIO`, `DODO_PRODUCT_ID_CREDITS_500`
- `DODO_PRODUCT_IDS` gains `STUDIO` key
- `DODO_CREDIT_PACK_IDS` gains `CREDITS_500` key
- `tierFromProductId()` returns `"STUDIO"` as valid tier
- Webhook handlers already tier-agnostic — work automatically for Studio

---

## 4. Priority Queue

### BullMQ Native Priority

Lower number = higher priority. Pro and Studio jobs processed first.

```typescript
export const TIER_QUEUE_PRIORITY: Record<string, number> = {
  FREE:    10,
  STARTER: 10,
  PRO:     1,
  STUDIO:  1,
};
```

### Implementation

Generation API routes add `priority` to BullMQ job options:

```typescript
const priority = TIER_QUEUE_PRIORITY[userTier] ?? 10;
await queue.add(jobType, jobData, { priority, ...existingOptions });
```

No worker changes — BullMQ automatically picks higher-priority jobs first.

### UI

"Priority" badge shown next to queued jobs in `GenerationQueue` for Pro/Studio users.

---

## 5. UI Changes

### Billing Tab

- Add Studio plan card ($35/mo, 500 credits, priority queue)
- Add Mega credit pack (500/$35) as fourth option
- Pro and Studio cards show "Priority queue" badge

### Landing Page Pricing

Four cards:
- **Free** ($0): 15 credits, Quick mode (drafts only), no KDP export
- **Starter** ($9/mo): 100 credits/month, all modes, KDP-ready export
- **Pro** ($19/mo): 250 credits/month, all modes, KDP-ready export, priority queue
- **Studio** ($35/mo): 500 credits/month, all modes, KDP-ready export, priority queue

### Model Selector

- Quick: updated description emphasizing draft/experimental nature
- Detailed: credit cost badge shows "4 credits" (was 3)
- Premium: credit cost badge shows "6 credits" (was 5)

### Export Gating

- Export button disabled for Quick images
- Tooltip: *"Quick images are drafts — generate with Detailed or Premium for KDP-ready export"*

### Credit Display

- Navbar badge: total balance only (simple)
- Transaction history: unchanged

---

## 6. Files Affected

### App (`src/`)
- `prisma/schema.prisma` — add `STUDIO` to Tier enum, add CreditPool model, update Generation.model default
- `src/lib/constants.ts` — credit costs, tier credits, tier order, plan prices, credit packs, AI_MODELS (+ exportable field), QUICK_CREATE_TIER_CONFIG
- `src/lib/credits.ts` — reserveCredits, reserveExtensionCredits, reserveAiFillCredits, refundCredits, grantCredits → all updated to use CreditPool via spendCredits. Remove openai fallback.
- `src/lib/dodo.ts` — DODO_PRODUCT_IDS, DODO_CREDIT_PACK_IDS, tierFromProductId return type + STUDIO
- `src/lib/auth.ts` — signup grant amount (20 → 15), create SIGNUP_GRANT pool
- `src/app/api/generations/route.ts` — add BullMQ priority
- `src/app/api/generations/[id]/extend/route.ts` — add BullMQ priority
- `src/app/api/checkout/route.ts` — Zod schema + STUDIO tier + CREDITS_500 pack
- `src/app/api/webhooks/dodo/route.ts` — renewal/plan-change create pools, handle Studio
- `src/app/api/projects/[id]/export/route.ts` — reject Quick model exports
- `src/app/settings/billing-tab.tsx` — Studio card, Mega pack, priority badge
- `src/app/page.tsx` — four pricing cards
- `src/components/editor/right-sidebar.tsx` (or wherever export button lives) — disable for Quick
- `src/components/editor/generation-queue.tsx` — priority badge

### Worker (`worker/`)
- `worker/prisma/schema.prisma` — add `STUDIO` to Tier enum, add CreditPool model, update Generation.model default
- `worker/src/lib/constants.ts` — GEMINI_MODEL_IDS, GEMINI_MODEL_CONFIG, CREDIT_COST_PER_IMAGE
- `worker/src/lib/credits.ts` — refundCredits updated to create REFUND pool
- `worker/src/processors/generation.processor.ts` — skip upscale+crop for Quick, read actual dimensions from Sharp metadata for GeneratedImage rows
- Expiry sweep logic (new — startup + hourly setInterval)

---

## 7. Margin Table

| Mode | Credits | Est. Cost/Gen | Revenue at $0.10/cr | Margin |
|------|---------|---------------|---------------------|--------|
| AI Fill | 1 | $0.003 | $0.10 | ~3200% |
| Quick | 2 | ~$0.068 | $0.20 | ~194% |
| Detailed | 4 | ~$0.164 | $0.40 | ~144% |
| Premium | 6 | ~$0.243 | $0.60 | ~147% |

Premium margin is better than spec estimated ($0.243 vs $0.291) since thinking config is not explicitly set.

---

## 8. Data Migration

App is not live yet — no existing users to migrate. The migration is purely additive:
1. Add `STUDIO` to `Tier` enum in both Prisma schemas
2. Add `CreditPool` model to both Prisma schemas
3. Update `Generation.model` default from `"openai"` to `"quick"`
4. Run `prisma migrate dev` + regenerate both clients

No data backfill needed since there are no existing users or credit balances.
