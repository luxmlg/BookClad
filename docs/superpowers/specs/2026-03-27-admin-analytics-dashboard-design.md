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
  id               String       @id @default(cuid())
  userId           String
  generationId     String?      // null for AI Fill/AI Edit
  type             ApiUsageType // GENERATION, AI_FILL, AI_EDIT
  provider         String       // "gemini", "replicate", etc.
  model            String       // "gemini-3.1-flash-image-preview", etc.

  // Tokens
  promptTokens     Int?
  candidatesTokens Int?
  totalTokens      Int?
  estimatedCostUsd Float?

  // Outcome
  success          Boolean
  durationMs       Int?         // API call latency
  attempt          Int          @default(1) // 1 = first try, 2 = first retry, etc.

  // Structured error
  errorCode        String?      // HTTP status or API error code
  errorType        String?      // rate_limit, safety_filter, server_error, timeout, invalid_request, unknown
  errorMessage     String?      // human-readable summary
  errorDetails     Json?        // full raw error response body

  // Full response metadata (everything except content)
  responseMetadata Json?        // safety ratings, finish reason, model version, etc.

  createdAt        DateTime     @default(now())

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  generation Generation? @relation(fields: [generationId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([generationId])
  @@index([type])
  @@index([createdAt])
  @@index([success])
}

enum ApiUsageType {
  GENERATION
  AI_FILL
  AI_EDIT
}
```

Added to both `prisma/schema.prisma` and `worker/prisma/schema.prisma` (separate packages, same schema).

### Pricing constants

`GEMINI_PRICING` constant in both `src/lib/constants.ts` and `worker/src/lib/constants.ts`, keyed by model ID:

```typescript
export const GEMINI_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "gemini-3.1-flash-image-preview": { inputPerMillion: 0.10, outputPerMillion: 0.40 },
  "gemini-3-pro-image-preview":     { inputPerMillion: 1.25, outputPerMillion: 5.00 },
  "gemini-2.5-flash":               { inputPerMillion: 0.15, outputPerMillion: 0.60 },
};
```

Rates updated manually when Google changes pricing. `estimatedCostUsd` computed at write time.

### `responseMetadata` contents

Everything the API returns except actual content (image bytes / text). For Gemini: `finishReason`, `safetyRatings`, `citationMetadata`, `modelVersion`, `cachedContentTokenCount`. Stored as raw JSON — no schema imposed, provider-agnostic.

---

## Data Capture

### Shared utility

A helper function that takes a raw Gemini response and extracts:
- Token counts from `usageMetadata`
- `estimatedCostUsd` computed from `GEMINI_PRICING[model]`
- Response metadata (everything except content)
- Error classification if the call failed

One copy in `worker/src/lib/api-usage.ts`, one in `src/lib/api-usage.ts` — same pattern as existing cross-package constants.

### Call site 1: Image generation (`worker/src/services/gemini.service.ts`)

`generateSingleImage()` wraps the existing `fetch()` call:
- Start timer before the call
- Parse `usageMetadata` and `candidates[0].finishReason` / `safetyRatings` from response
- On success: create `ApiUsage` with tokens, metadata, `success: true`, `attempt: retryCount + 1`
- On error: classify error type, create `ApiUsage` with `success: false`, structured error fields, raw error body in `errorDetails`
- If `finishReason` is `SAFETY`: throw `SafetyFilterError` (non-retryable)

### Call site 2: AI Fill (`src/lib/ai-fill.ts`)

`generateAttributeSuggestions()` — same pattern. Capture `usageMetadata`, write `ApiUsage` with `type: AI_FILL`, `generationId: null`. `userId` passed from the API route.

### Call site 3: AI Edit (`src/app/api/attributes/edit/route.ts`)

Same as AI Fill. Write `ApiUsage` with `type: AI_EDIT`.

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

Safety filter detection: check `finishReason === "SAFETY"` in the response, or safety-related error codes/messages in error responses. Currently safety blocks fall into "other errors" and retry up to 5 times — this fixes that.

---

## Admin Dashboard

### Access control

- Env var: `ADMIN_EMAILS` (comma-separated email addresses)
- Route: `/admin`
- Check: server-side, `session.user.email` must be in the list
- Unauthorized: return **404** (not 403 — don't reveal the page exists)

### Architecture

Server components querying Prisma directly — no separate API routes. Chart data passed as props to thin client chart wrappers. Recharts for visualization.

### Page sections

#### 1. Revenue Overview

**Metrics:**
- Total subscribers by tier (FREE, STARTER, PRO, STUDIO)
- Monthly recurring revenue (subscribers x `PLAN_PRICES`)
- Credit pack revenue (sum of PURCHASE CreditTransactions, grouped by month)
- Total revenue = MRR + credit pack sales

**Charts:**
- Revenue over time — line chart, monthly (MRR + credit packs)
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
- Gross profit (revenue - API costs)
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
| Credit balance desync | `User.creditBalance` != sum of user's `CreditPool.remaining` |
| Orphaned processing | Generation stuck in PROCESSING >30min with no ApiUsage rows |
| Cancellation race | Generation FAILED (cancelled) but has `ApiUsage.success: true` rows created after cancellation time |

### Time range

Date picker at the top of the page. Defaults to current month. All sections filter by selected range.

### Data freshness

No real-time updates, no caching. Server components query on page load. Refresh the page for fresh data.

---

## Dependencies

- **New package:** `recharts` (root app only, not worker)
- **Schema changes:** `ApiUsage` model + `ApiUsageType` enum in both Prisma schemas
- **New env var:** `ADMIN_EMAILS`
- **New constants:** `GEMINI_PRICING` in both packages

---

## File changes summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ApiUsage` model, `ApiUsageType` enum, relation on User/Generation |
| `worker/prisma/schema.prisma` | Same |
| `src/lib/constants.ts` | Add `GEMINI_PRICING`, `ApiUsageType` |
| `worker/src/lib/constants.ts` | Add `GEMINI_PRICING`, `ApiUsageType` |
| `src/lib/api-usage.ts` | New — shared utility for parsing Gemini response metadata, computing cost |
| `worker/src/lib/api-usage.ts` | New — same utility for worker |
| `worker/src/services/gemini.service.ts` | Capture `usageMetadata`, create `ApiUsage` row, throw `SafetyFilterError` |
| `worker/src/services/generation.processor.ts` | Handle `SafetyFilterError` as non-retryable |
| `src/lib/ai-fill.ts` | Capture `usageMetadata`, create `ApiUsage` row |
| `src/app/api/attributes/edit/route.ts` | Capture `usageMetadata`, create `ApiUsage` row |
| `src/app/admin/page.tsx` | New — admin dashboard server component |
| `src/app/admin/layout.tsx` | New — admin access gate |
| `src/app/admin/components/` | New — chart wrappers, anomaly flags, section components |
| `src/middleware.ts` or `src/proxy.ts` | Exclude `/admin` from public access (or handle in layout) |
