# Admin Analytics Dashboard — Token Usage, Revenue & Profitability

**Date:** 2026-03-27
**Status:** Draft

## Problem

BookClad charges credits for AI operations (image generation, AI Fill, AI Edit) but has no visibility into actual API costs. There's no way to answer: "Are we profitable per credit? Are retries silently costing us? Are there money leaks?"

## Goals

1. Track token usage and estimated USD cost for every AI API call
2. Surface revenue, costs, and profitability in an admin dashboard
3. Detect financial anomalies (money leaks, duplicate refunds, desync)
4. Improve error classification — safety filter blocks should not retry

## Non-Goals

- User-facing token/cost data
- Alerts or notifications (Slack, email)
- Historical backfill of existing generations
- Real-time dashboard updates (page refresh is fine)

---

## Data Model

### `ApiUsage` table

One row per AI API call. Captures tokens, cost, outcome, and full response metadata.

```prisma
model ApiUsage {
  id               String   @id @default(cuid())
  userId           String?  // nullable — preserved with null on account deletion
  generationId     String?  // null for AI Fill/AI Edit
  type             String   // "GENERATION", "AI_FILL", "AI_EDIT"
  provider         String   // "gemini", "replicate", etc.
  model            String   // "gemini-3.1-flash-image-preview", etc.

  // Tokens
  promptTokens     Int?
  candidatesTokens Int?
  totalTokens      Int?
  estimatedCostUsd Decimal? @db.Decimal(10, 6)

  // Outcome
  success          Boolean
  durationMs       Int?     // API call latency
  attempt          Int      @default(1) // BullMQ job attempt number (job.attemptsMade + 1), not per-call retries

  // Structured error
  errorCode        String?  // HTTP status or API error code
  errorType        String?  // rate_limit, safety_filter, server_error, timeout, invalid_request, unknown
  errorMessage     String?  // human-readable summary
  errorDetails     Json?    // full raw error response body

  // Full response metadata (everything except content)
  responseMetadata Json?    // safety ratings, finish reason, model version, etc.

  createdAt        DateTime @default(now())

  user       User        @relation(fields: [userId], references: [id], onDelete: SetNull)
  generation Generation? @relation(fields: [generationId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([generationId])
  @@index([type])
  @@index([createdAt])
  @@index([success])
}
```

**Relation fields**: Both `User` and `Generation` models need an `apiUsages ApiUsage[]` reverse relation added.

**No Prisma enum**: `type` is a plain `String` column. The allowed values are defined as an `as const` object (`API_USAGE_TYPE`) in both `src/lib/constants.ts` and `worker/src/lib/constants.ts` — consistent with how `GENERATION_STATUS` and `JOB_TYPE` work.

```typescript
export const API_USAGE_TYPE = {
  GENERATION: "GENERATION",
  AI_FILL: "AI_FILL",
  AI_EDIT: "AI_EDIT",
} as const;
```

**`onDelete: SetNull` for User**: `userId` is nullable (`String?`). When a user deletes their account, `ApiUsage` rows are preserved with `userId: null` for historical cost analytics. This is intentional — aggregate cost data should survive individual account deletions for profitability tracking.

**`onDelete: SetNull` for Generation**: When a generation is deleted (cascade from project deletion or direct), `ApiUsage` rows are preserved with `generationId: null`. Same rationale — cost data outlives its source.

**`estimatedCostUsd` uses `Decimal(10, 6)`** instead of `Float` to avoid IEEE 754 floating-point precision drift when summing across many rows.

Added to both `prisma/schema.prisma` and `worker/prisma/schema.prisma`. The worker schema only needs models the worker uses — `ApiUsage` is needed because the worker writes rows for image generation.

### Pricing constants

`GEMINI_PRICING` constant in both `src/lib/constants.ts` and `worker/src/lib/constants.ts`, keyed by model ID:

```typescript
export const GEMINI_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number; perImage?: number }> = {
  "gemini-3.1-flash-image-preview": { inputPerMillion: 0.10, outputPerMillion: 0.40, perImage: 0.02 },
  "gemini-3-pro-image-preview":     { inputPerMillion: 1.25, outputPerMillion: 5.00, perImage: 0.07 },
  "gemini-2.5-flash":               { inputPerMillion: 0.15, outputPerMillion: 0.60 },
};
```

Image generation models include a `perImage` rate since Gemini image generation may bill per image, not just per token. `estimatedCostUsd` is computed as `max(tokenBasedCost, perImageCost)` — whichever is higher — or summed if both apply. The exact billing model will become clear from the `usageMetadata` data we collect. Text-only models (AI Fill/Edit) use token-based pricing only.

Rates updated manually when Google changes pricing. `estimatedCostUsd` computed at write time. These are estimates for internal analytics, not billed amounts.

### `responseMetadata` contents

Everything the API returns except actual content (image bytes / text). For Gemini: `finishReason`, `safetyRatings`, `citationMetadata`, `modelVersion`, `cachedContentTokenCount`. Stored as raw JSON — no schema imposed, provider-agnostic.

### Data retention

`ApiUsage` grows with every API call. Expected growth: ~8 rows per generation (one per image) + occasional AI Fill/Edit calls. At moderate usage this is manageable. No cleanup needed initially. If the table grows large (>1M rows), consider: (a) dropping `responseMetadata` and `errorDetails` on rows older than 90 days, (b) archiving rows older than 1 year to a separate table. Revisit after 6 months of data.

---

## Data Capture

### Shared utility

A helper function that takes a raw Gemini response and returns a structured result:
- Token counts from `usageMetadata`
- `estimatedCostUsd` computed from `GEMINI_PRICING[model]`
- Response metadata (everything except content)
- Error classification if the call failed

One copy in `worker/src/lib/api-usage.ts`, one in `src/lib/api-usage.ts` — same pattern as existing cross-package constants.

### Call site 1: Image generation (`worker/src/services/gemini.service.ts`)

`generateSingleImage()` wraps the existing `fetch()` call:
- Start timer before the call
- Parse full JSON response (not just image buffer)
- Extract `usageMetadata` and `candidates[0].finishReason` / `safetyRatings`
- On success: create `ApiUsage` with tokens, metadata, `success: true`, `attempt: job.attemptsMade + 1`
- On HTTP error: classify error type, create `ApiUsage` with `success: false`, structured error fields, raw error body in `errorDetails`
- On HTTP 200 with `finishReason: "SAFETY"` or empty image buffers: create `ApiUsage` with `success: false`, `errorType: "safety_filter"`, then throw `SafetyFilterError`

The worker already has Prisma access, so it writes `ApiUsage` directly.

### Call site 2: AI Fill (`src/lib/ai-fill.ts` + `src/app/api/attributes/generate/route.ts`)

`generateAttributeSuggestions()` currently returns `AiFillSuggestion[]`. Change it to also return response metadata — return `{ suggestions, usageMetadata }`. The API route (`/api/attributes/generate`) has the `userId` from session and writes the `ApiUsage` row. This preserves `ai-fill.ts` as a utility without Prisma dependency.

### Call site 3: AI Edit (`src/app/api/attributes/edit/route.ts`)

Same pattern as AI Fill. The Gemini call is already inline in the route, so capture `usageMetadata` from the response and write `ApiUsage` directly in the route handler.

### Failure resilience

`ApiUsage` writes are **best-effort**. Wrapped in try/catch — if logging fails, the actual operation still proceeds. `console.error` on failure, never break the main flow.

---

## Error Classification

Updated error type classification for the generation processor:

| errorType | Retryable? | Action |
|-----------|-----------|--------|
| `rate_limit` | Yes | Retry with backoff |
| `server_error` | Yes | Retry with backoff |
| `timeout` | Yes | Retry with backoff |
| `safety_filter` | **No** | Fail immediately, refund |
| `invalid_request` | No | Fail immediately, refund |
| `unknown` | No | Fail immediately, refund |

### Safety filter detection

Safety blocks can appear in two forms:

1. **HTTP 200 with blocked content**: `finishReason === "SAFETY"` in the response, or `extractImageBuffers()` returns empty despite a 200 response. This is the most common path for content filtering.
2. **HTTP 4xx with safety error**: Error response body contains safety-related codes or messages.

Both paths create an `ApiUsage` row with `errorType: "safety_filter"` and throw `SafetyFilterError`.

### `SafetyFilterError` implementation

`SafetyFilterError` extends BullMQ's `UnrecoverableError` so the job fails immediately without retry. The processor's error handler does not need special-casing — BullMQ handles `UnrecoverableError` natively.

**Partial safety blocks**: If images 1-3 generate successfully but image 4 hits a safety filter, this is treated as partial success (Path 2) — the generation is marked `COMPLETED` with `errorMessage`, and only ungeneraed images are refunded. The safety block does NOT trigger retry of the whole job since `SafetyFilterError` extends `UnrecoverableError`.

---

## Admin Dashboard

### Access control

- Env var: `ADMIN_EMAILS` (comma-separated email addresses)
- Route: `/admin`
- Authentication: Add `/admin` to `protectedRoutes` in `src/proxy.ts` (requires login)
- Authorization: Admin layout checks `session.user.email` against `ADMIN_EMAILS`. If not in the list, return **404** (not 403 — don't reveal the page exists)
- SEO: Export `robots: { index: false, follow: false }` from admin layout. Add `/admin` to disallow list in `src/app/robots.ts`.

### Architecture

Server components querying Prisma directly — no separate API routes. Chart data passed as props to thin Recharts client wrappers. `recharts` added as a dependency to root `package.json` only (not worker).

### Page sections

#### 1. Revenue Overview

**Metrics:**
- Total subscribers by tier (FREE, STARTER, PRO, STUDIO)
- Estimated MRR (subscribers x `PLAN_PRICES`) — note: this is an approximation based on current active subscribers, not actual payment events. Does not account for mid-month cancellations, failed payments, or price changes. For exact revenue, check DodoPayments dashboard.
- Credit pack revenue (sum of PURCHASE CreditTransactions, grouped by month)
- Total estimated revenue = estimated MRR + credit pack sales

**Charts:**
- Revenue over time — line chart, monthly (estimated MRR + credit packs)
- Subscribers by tier — donut chart

#### 2. AI Cost Breakdown

**Metrics:**
- Token usage by model and operation type (GENERATION, AI_FILL, AI_EDIT)
- Estimated USD cost by model (sum `estimatedCostUsd` from ApiUsage)
- Cost per credit (total API cost / total credits consumed)
- Retry cost (sum `estimatedCostUsd` where `attempt > 1`)

**Charts:**
- Cost over time by operation type — stacked bar chart, daily/monthly toggle
- Token usage by model — bar chart

#### 3. Profitability

**Metrics:**
- Gross profit (estimated revenue - API costs)
- Profit margin percentage
- Per-tier profitability
- Trend direction

**Charts:**
- Revenue vs Cost vs Profit — line chart, monthly
- Cost per credit trend — line chart, monthly

#### 4. Anomaly Flags

Automated checks surfaced as counts with drill-down:

| Flag | Detection |
|------|-----------|
| Money leak | All ApiUsage rows for a generation have `success: true`, but a REFUND CreditTransaction exists |
| User overcharged | Generation FAILED with no REFUND CreditTransaction |
| Duplicate refunds | Generation with >1 REFUND CreditTransaction |
| Credit balance desync | Batch query: `SELECT userId, creditBalance, SUM(remaining)` with `GROUP BY` and `HAVING` clause to find mismatches — not per-user iteration |
| Orphaned processing | Generation stuck in PROCESSING >30min with no ApiUsage rows |
| Cancellation race | Generation FAILED (cancelled) but has `ApiUsage.success: true` rows created after cancellation time |

Each anomaly shows as a count with a drill-down to the affected records.

### Time range

Date picker at the top of the page. Defaults to current month. All sections filter by selected range.

### Data freshness

No real-time updates, no caching. Server components query on page load. Refresh the page for fresh data.

---

## Dependencies

- **New package:** `recharts` (root app only, not worker)
- **Schema changes:** `ApiUsage` model in both Prisma schemas, `apiUsages` reverse relation on User and Generation
- **New env var:** `ADMIN_EMAILS`
- **New constants:** `GEMINI_PRICING`, `API_USAGE_TYPE` in both packages

---

## File changes summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ApiUsage` model, `apiUsages` relation on User and Generation |
| `worker/prisma/schema.prisma` | Same |
| `src/lib/constants.ts` | Add `GEMINI_PRICING`, `API_USAGE_TYPE` |
| `worker/src/lib/constants.ts` | Add `GEMINI_PRICING`, `API_USAGE_TYPE` |
| `src/lib/api-usage.ts` | New — shared utility for parsing Gemini response metadata, computing cost |
| `worker/src/lib/api-usage.ts` | New — same utility for worker |
| `worker/src/services/gemini.service.ts` | Capture `usageMetadata`, create `ApiUsage` row, throw `SafetyFilterError` |
| `worker/src/processors/generation.processor.ts` | `SafetyFilterError` handled via `UnrecoverableError` (no special-casing needed) |
| `src/lib/ai-fill.ts` | Return `usageMetadata` alongside suggestions |
| `src/app/api/attributes/generate/route.ts` | Write `ApiUsage` row with usage data from ai-fill |
| `src/app/api/attributes/edit/route.ts` | Capture `usageMetadata`, write `ApiUsage` row |
| `src/app/admin/page.tsx` | New — admin dashboard server component |
| `src/app/admin/layout.tsx` | New — admin access gate (email check, 404 on unauthorized) |
| `src/app/admin/components/` | New — chart wrappers, anomaly flags, section components |
| `src/proxy.ts` | Add `/admin` to `protectedRoutes` |
| `src/app/robots.ts` | Add `/admin` to disallow list |
