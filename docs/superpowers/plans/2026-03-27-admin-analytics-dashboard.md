# Admin Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track token usage and costs for every AI API call, surface revenue/cost/profitability in an admin dashboard, and detect financial anomalies.

**Architecture:** New `ApiUsage` Prisma model captures per-call token data. A shared utility parses Gemini responses into structured records. Three call sites (worker image gen, AI Fill, AI Edit) write rows best-effort. Admin dashboard at `/admin` (email-gated) queries Prisma directly with Recharts visualizations.

**Tech Stack:** Prisma, Next.js server components, Recharts, Gemini REST API `usageMetadata`

**Spec:** `docs/superpowers/specs/2026-03-27-admin-analytics-dashboard-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add `ApiUsage` model, reverse relations |
| `worker/prisma/schema.prisma` | Same (worker's copy) |
| `src/lib/constants.ts` | Add `API_USAGE_TYPE`, `GEMINI_PRICING` |
| `worker/src/lib/constants.ts` | Same (worker's copy) |
| `src/lib/api-usage.ts` | New — parse Gemini response metadata, compute cost, classify errors |
| `worker/src/lib/api-usage.ts` | New — same utility for worker (separate package) |
| `worker/src/services/gemini.service.ts` | Expand `GeminiResponse` interface, capture `usageMetadata`, return metadata alongside buffer, add `SafetyFilterError` |
| `worker/src/processors/generation.processor.ts` | Write `ApiUsage` rows per image, pass attempt number |
| `src/lib/ai-fill.ts` | Return `usageMetadata` alongside suggestions |
| `src/app/api/attributes/generate/route.ts` | Write `ApiUsage` row for AI Fill |
| `src/app/api/attributes/edit/route.ts` | Capture `usageMetadata`, write `ApiUsage` row for AI Edit |
| `src/proxy.ts` | Add `/admin` to protected routes + matcher |
| `src/app/robots.ts` | Add `/admin` to disallow list |
| `src/app/admin/layout.tsx` | New — admin email gate, 404 for non-admins, robots metadata |
| `src/app/admin/page.tsx` | New — dashboard with date range, delegates to section components |
| `src/app/admin/components/revenue-section.tsx` | New — subscriber counts, MRR, credit pack revenue, charts |
| `src/app/admin/components/cost-section.tsx` | New — token usage, API costs, retry costs, charts |
| `src/app/admin/components/profitability-section.tsx` | New — revenue vs cost, margins, trends |
| `src/app/admin/components/anomaly-section.tsx` | New — anomaly flag queries with drill-down |
| `src/app/admin/components/charts.tsx` | New — thin Recharts client wrappers (line, bar, donut) |
| `src/app/admin/components/metric-card.tsx` | New — shared metric card component |
| `src/app/admin/lib/queries.ts` | New — Prisma query functions for all dashboard data |

---

### Task 1: Prisma Schema — Add `ApiUsage` Model

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `worker/prisma/schema.prisma`

- [ ] **Step 1: Add `ApiUsage` model and reverse relations to root schema**

In `prisma/schema.prisma`, add the `ApiUsage` model after `CreditPool` (after line 198), and add `apiUsages ApiUsage[]` to the `User` model (after line 39) and the `Generation` model (after line 159):

```prisma
// Add to User model, after creditPools line:
  apiUsages          ApiUsage[]

// Add to Generation model, after creditTransactions line:
  apiUsages          ApiUsage[]

// Add after CreditPool model:
model ApiUsage {
  id               String   @id @default(cuid())
  userId           String?
  generationId     String?
  type             String   // "GENERATION", "AI_FILL", "AI_EDIT"
  provider         String   // "gemini", "replicate", etc.
  model            String

  promptTokens     Int?
  candidatesTokens Int?
  totalTokens      Int?
  estimatedCostUsd Decimal? @db.Decimal(10, 6)

  success          Boolean
  durationMs       Int?
  attempt          Int      @default(1)

  errorCode        String?
  errorType        String?
  errorMessage     String?
  errorDetails     Json?

  responseMetadata Json?

  createdAt        DateTime @default(now())

  user       User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  generation Generation? @relation(fields: [generationId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([generationId])
  @@index([type])
  @@index([createdAt])
  @@index([success])
}
```

- [ ] **Step 2: Apply the same changes to worker schema**

Copy the exact same `ApiUsage` model to `worker/prisma/schema.prisma` after `CreditPool`. Add the same `apiUsages ApiUsage[]` reverse relations to `User` and `Generation` in the worker schema.

- [ ] **Step 3: Run migration and regenerate clients**

```bash
npx prisma migrate dev --name add-api-usage
npx prisma generate
cd worker && npx prisma generate
```

- [ ] **Step 4: Type-check both packages**

```bash
npx tsc --noEmit
cd worker && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add prisma/ worker/prisma/ src/generated/ worker/src/generated/
git commit -m "schema: add ApiUsage model for token usage tracking"
```

---

### Task 2: Constants — Add `API_USAGE_TYPE` and `GEMINI_PRICING`

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `worker/src/lib/constants.ts`

- [ ] **Step 1: Add constants to `src/lib/constants.ts`**

Add after the `WS_MESSAGE_TYPE` block (after line 209):

```typescript
export const API_USAGE_TYPE = {
  GENERATION: "GENERATION",
  AI_FILL: "AI_FILL",
  AI_EDIT: "AI_EDIT",
} as const;
export type ApiUsageType = typeof API_USAGE_TYPE[keyof typeof API_USAGE_TYPE];

export const GEMINI_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number; perImage?: number }> = {
  "gemini-3.1-flash-image-preview": { inputPerMillion: 0.10, outputPerMillion: 0.40, perImage: 0.02 },
  "gemini-3-pro-image-preview": { inputPerMillion: 1.25, outputPerMillion: 5.00, perImage: 0.07 },
  "gemini-2.5-flash": { inputPerMillion: 0.15, outputPerMillion: 0.60 },
};
```

- [ ] **Step 2: Add constants to `worker/src/lib/constants.ts`**

Add the exact same `API_USAGE_TYPE` and `GEMINI_PRICING` blocks after line 74.

- [ ] **Step 3: Type-check both packages**

```bash
npx tsc --noEmit
cd worker && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts worker/src/lib/constants.ts
git commit -m "feat: add API_USAGE_TYPE and GEMINI_PRICING constants"
```

---

### Task 3: Shared Utility — `api-usage.ts`

**Files:**
- Create: `worker/src/lib/api-usage.ts`
- Create: `src/lib/api-usage.ts`

Both files are identical. The worker and app can't import from each other — same pattern as cross-package constants.

- [ ] **Step 1: Create `worker/src/lib/api-usage.ts`**

```typescript
import { Prisma } from "../generated/prisma/client.js";
import { GEMINI_PRICING } from "./constants.js";

/** Fields from Gemini's usageMetadata */
export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
}

/** Structured result from parsing a Gemini API response */
export interface ParsedApiUsage {
  promptTokens: number | null;
  candidatesTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: Prisma.Decimal | null;
  responseMetadata: Record<string, unknown> | null;
}

/** Error type classification for retry decisions */
export type ErrorType = "rate_limit" | "safety_filter" | "server_error" | "timeout" | "invalid_request" | "unknown";

/**
 * Parse usageMetadata from a Gemini API response and compute estimated cost.
 * Pass the full response JSON (parsed). Content (image/text) is stripped from metadata.
 */
export function parseGeminiUsage(
  responseJson: Record<string, unknown>,
  modelId: string,
): ParsedApiUsage {
  const usage = responseJson.usageMetadata as GeminiUsageMetadata | undefined;

  const promptTokens = usage?.promptTokenCount ?? null;
  const candidatesTokens = usage?.candidatesTokenCount ?? null;
  const totalTokens = usage?.totalTokenCount ?? null;

  const estimatedCostUsd = computeCost(modelId, promptTokens, candidatesTokens);

  // Build responseMetadata: everything except candidates content
  const metadata: Record<string, unknown> = {};
  const candidates = responseJson.candidates as Array<Record<string, unknown>> | undefined;
  if (candidates?.[0]) {
    const { content, ...rest } = candidates[0];
    if (Object.keys(rest).length > 0) metadata.candidate = rest;
  }
  if (usage) metadata.usageMetadata = usage;
  if (responseJson.modelVersion) metadata.modelVersion = responseJson.modelVersion;

  return {
    promptTokens,
    candidatesTokens,
    totalTokens,
    estimatedCostUsd,
    responseMetadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
}

/**
 * Compute estimated USD cost from token counts and pricing table.
 */
function computeCost(
  modelId: string,
  promptTokens: number | null,
  candidatesTokens: number | null,
): Prisma.Decimal | null {
  const pricing = GEMINI_PRICING[modelId];
  if (!pricing) return null;

  let tokenCost = 0;
  if (promptTokens != null) {
    tokenCost += (promptTokens / 1_000_000) * pricing.inputPerMillion;
  }
  if (candidatesTokens != null) {
    tokenCost += (candidatesTokens / 1_000_000) * pricing.outputPerMillion;
  }

  // For image models, use per-image cost if higher
  const perImageCost = pricing.perImage ?? 0;
  const cost = Math.max(tokenCost, perImageCost);

  return cost > 0 ? new Prisma.Decimal(cost.toFixed(6)) : null;
}

/**
 * Classify an error for retry decisions.
 */
export function classifyError(
  statusCode: number,
  errorMessage: string,
  responseJson?: Record<string, unknown>,
): ErrorType {
  // Safety filter: check finishReason in response
  const candidates = (responseJson?.candidates ?? []) as Array<Record<string, unknown>>;
  const finishReason = candidates[0]?.finishReason as string | undefined;
  if (finishReason === "SAFETY" || finishReason === "BLOCKED_REASON_UNSPECIFIED") {
    return "safety_filter";
  }

  // Safety in error message
  if (/safety|blocked|harmful|prohibited/i.test(errorMessage)) {
    return "safety_filter";
  }

  // Rate limit
  if (statusCode === 429 || /rate.?limit/i.test(errorMessage) || /too many requests/i.test(errorMessage)) {
    return "rate_limit";
  }

  // Server error
  if (statusCode === 500 || statusCode === 503 || /overloaded/i.test(errorMessage) || /high demand/i.test(errorMessage)) {
    return "server_error";
  }

  // Timeout
  if (/timeout|timed out|aborted/i.test(errorMessage)) {
    return "timeout";
  }

  // Invalid request
  if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404) {
    return "invalid_request";
  }

  return "unknown";
}

/**
 * Check if an error type is retryable.
 */
export function isRetryableError(errorType: ErrorType): boolean {
  return errorType === "rate_limit" || errorType === "server_error" || errorType === "timeout";
}
```

- [ ] **Step 2: Create `src/lib/api-usage.ts`**

Same content as above, but with adjusted imports for the app package:

```typescript
import { Prisma } from "@/generated/prisma/client";
import { GEMINI_PRICING } from "./constants";
```

All other code is identical. The `.js` extensions are removed (app uses non-ESM imports).

- [ ] **Step 3: Type-check both packages**

```bash
npx tsc --noEmit
cd worker && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-usage.ts worker/src/lib/api-usage.ts
git commit -m "feat: add api-usage utility for parsing Gemini response metadata"
```

---

### Task 4: Worker — Update `gemini.service.ts`

**Files:**
- Modify: `worker/src/services/gemini.service.ts`

The key change: expand `GeminiResponse` to include `usageMetadata`, return metadata alongside the image buffer, add `SafetyFilterError`, and handle safety blocks.

- [ ] **Step 1: Add `SafetyFilterError` and expand `GeminiResponse`**

Add import at top of file:

```typescript
import { UnrecoverableError } from "bullmq";
```

Add `SafetyFilterError` class after the `GeminiApiError` class (after line 26):

```typescript
export class SafetyFilterError extends UnrecoverableError {
  constructor(message?: string) {
    super(message ?? "Content blocked by safety filter. Try adjusting your description.");
    this.name = "SafetyFilterError";
  }
}
```

Expand `GeminiResponse` interface to include `usageMetadata` and `finishReason` (replace lines 41-47):

```typescript
interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
    safetyRatings?: Array<{ category: string; probability: string }>;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  modelVersion?: string;
}
```

- [ ] **Step 2: Add result type and update return type**

Add after `GenerateSingleImageParams` interface (after line 73):

```typescript
export interface GenerationResult {
  imageBuffer: Buffer;
  responseJson: Record<string, unknown>;
  durationMs: number;
}
```

- [ ] **Step 3: Update `generateSingleImage` to return `GenerationResult`**

Change the function signature from `Promise<Buffer>` to `Promise<GenerationResult>`.

Add timer at the start of the function (after the API key check, after line 81):

```typescript
const startTime = Date.now();
```

Replace the error response handling (lines 132-136) to capture raw error body:

```typescript
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    const durationMs = Date.now() - startTime;
    console.error(`[gemini] HTTP ${res.status} for model ${modelId}:`, errBody);

    // Parse error body as JSON for metadata if possible
    let errorJson: Record<string, unknown> | undefined;
    try { errorJson = JSON.parse(errBody); } catch { /* ignore */ }

    // Check for safety-related errors in 4xx responses
    if (errorJson && /safety|blocked|harmful|prohibited/i.test(errBody)) {
      throw Object.assign(
        new SafetyFilterError(),
        { status: res.status, durationMs, errorJson },
      );
    }

    throw Object.assign(
      new GeminiApiError(res.status),
      { durationMs, errorJson },
    );
  }
```

Replace the success response handling (lines 138-143) to check safety and return metadata:

```typescript
  const data = (await res.json()) as GeminiResponse;
  const durationMs = Date.now() - startTime;

  // Check for safety filter on 200 response
  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason === "SAFETY" || finishReason === "BLOCKED_REASON_UNSPECIFIED") {
    throw Object.assign(
      new SafetyFilterError(),
      { status: 200, durationMs, responseJson: data as unknown as Record<string, unknown> },
    );
  }

  const buffers = extractImageBuffers(data);
  if (buffers.length === 0) {
    throw Object.assign(
      new SafetyFilterError("No images generated — content may have been filtered. Try adjusting your description."),
      { status: 200, durationMs, responseJson: data as unknown as Record<string, unknown> },
    );
  }

  return {
    imageBuffer: buffers[0],
    responseJson: data as unknown as Record<string, unknown>,
    durationMs,
  };
```

Also update the fetch catch block (lines 124-130) to attach `durationMs`:

```typescript
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[gemini] fetch failed for model ${modelId}:`, err);
    throw Object.assign(
      new Error("Could not reach the image generation service. Please try again.", { cause: err }),
      { durationMs },
    );
  }
```

- [ ] **Step 4: Type-check**

```bash
cd worker && npx tsc --noEmit
```

This will fail because `generation.processor.ts` still expects `Buffer` from `generateSingleImage`. That's expected — we fix it in Task 5.

- [ ] **Step 5: Commit**

```bash
git add worker/src/services/gemini.service.ts
git commit -m "feat: return token metadata from generateSingleImage, add SafetyFilterError"
```

---

### Task 5: Worker — Update `generation.processor.ts`

**Files:**
- Modify: `worker/src/processors/generation.processor.ts`

Write `ApiUsage` rows for each API call. Update to use `GenerationResult` instead of raw `Buffer`. Integrate `classifyError` and `isRetryableError`.

- [ ] **Step 1: Add imports**

Add to the import from `gemini.service.js` (line 5):

```typescript
import { generateSingleImage, SafetyFilterError } from "../services/gemini.service.js";
import type { GenerationResult } from "../services/gemini.service.js";
```

Add new imports:

```typescript
import { parseGeminiUsage, classifyError, isRetryableError } from "../lib/api-usage.js";
import { API_USAGE_TYPE } from "../lib/constants.js";
```

- [ ] **Step 2: Create helper to write `ApiUsage` (best-effort)**

Add before `processGeneration` function:

```typescript
async function logApiUsage(data: {
  userId: string;
  generationId: string;
  modelId: string;
  attempt: number;
  result?: GenerationResult;
  error?: { message: string; status?: number; durationMs?: number; errorJson?: Record<string, unknown>; responseJson?: Record<string, unknown> };
}): Promise<void> {
  try {
    const { userId, generationId, modelId, attempt } = data;

    if (data.result) {
      const parsed = parseGeminiUsage(data.result.responseJson, modelId);
      await prisma.apiUsage.create({
        data: {
          userId,
          generationId,
          type: API_USAGE_TYPE.GENERATION,
          provider: "gemini",
          model: modelId,
          promptTokens: parsed.promptTokens,
          candidatesTokens: parsed.candidatesTokens,
          totalTokens: parsed.totalTokens,
          estimatedCostUsd: parsed.estimatedCostUsd,
          success: true,
          durationMs: data.result.durationMs,
          attempt,
          responseMetadata: parsed.responseMetadata,
        },
      });
    } else if (data.error) {
      const errorType = classifyError(
        data.error.status ?? 0,
        data.error.message,
        data.error.responseJson,
      );
      // Try to parse usage from error response if available
      const parsed = data.error.responseJson
        ? parseGeminiUsage(data.error.responseJson, modelId)
        : null;

      await prisma.apiUsage.create({
        data: {
          userId,
          generationId,
          type: API_USAGE_TYPE.GENERATION,
          provider: "gemini",
          model: modelId,
          promptTokens: parsed?.promptTokens ?? null,
          candidatesTokens: parsed?.candidatesTokens ?? null,
          totalTokens: parsed?.totalTokens ?? null,
          estimatedCostUsd: parsed?.estimatedCostUsd ?? null,
          success: false,
          durationMs: data.error.durationMs ?? null,
          attempt,
          errorCode: data.error.status ? String(data.error.status) : null,
          errorType,
          errorMessage: data.error.message,
          errorDetails: data.error.errorJson ?? data.error.responseJson ?? null,
          responseMetadata: parsed?.responseMetadata ?? null,
        },
      });
    }
  } catch (logErr) {
    console.error("[api-usage] Failed to log API usage:", logErr);
  }
}
```

- [ ] **Step 3: Update the image generation loop**

Replace the `generateSingleImage` call and processing (lines 124-129) to use the new `GenerationResult`:

```typescript
      let result: GenerationResult;
      try {
        result = await generateSingleImage({
          prompt: fullPrompt,
          referenceImage: refBuffer,
          modelId: geminiModelId,
          config: geminiConfig,
        });
      } catch (genErr) {
        // Log failed API call
        const errObj = genErr as Error & { status?: number; durationMs?: number; errorJson?: Record<string, unknown>; responseJson?: Record<string, unknown> };
        await logApiUsage({
          userId,
          generationId,
          modelId: geminiModelId,
          attempt: job.attemptsMade + 1,
          error: {
            message: errObj.message,
            status: errObj.status,
            durationMs: errObj.durationMs,
            errorJson: errObj.errorJson,
            responseJson: errObj.responseJson,
          },
        });
        throw genErr;
      }

      // Log successful API call
      await logApiUsage({
        userId,
        generationId,
        modelId: geminiModelId,
        attempt: job.attemptsMade + 1,
        result,
      });

      const rawImage = result.imageBuffer;
```

The rest of the processing (upscale, crop, upload) remains the same, using `rawImage` instead of the old direct return.

- [ ] **Step 4: Add SafetyFilterError guard and update retry classification**

Add an explicit guard at the top of the catch block, right after the cancellation check (after line 186). This prevents SafetyFilterError from entering the retry logic at all:

```typescript
    // Guard: SafetyFilterError is non-retryable (extends UnrecoverableError)
    // Explicit guard in case classifyError misses it
    if (error instanceof SafetyFilterError) {
      throw error; // UnrecoverableError — BullMQ will not retry
    }
```

Then replace the retry classification block (lines 242-257). The existing `isHighDemand` regex logic is replaced by `classifyError`:

```typescript
    const statusCode = error instanceof Error && "status" in error
      ? (error as Error & { status: number }).status
      : 0;
    const errorType = classifyError(statusCode, errorMsg);
    const retryable = isRetryableError(errorType) && !job.data.isExtension;

    const isHighDemand = errorType === "rate_limit" || errorType === "server_error";
    const retryReason = isHighDemand ? "high_demand" : "error";
    const maxRetries = isHighDemand ? MAX_HIGH_DEMAND_RETRIES : MAX_OTHER_RETRIES;

    const attemptNumber = job.attemptsMade + 1;
    const canRetry = retryable && attemptNumber < maxRetries;
```

Then use `canRetry` instead of `retryable` in the `if (retryable)` block (line 259).

- [ ] **Step 5: Type-check**

```bash
cd worker && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add worker/src/processors/generation.processor.ts
git commit -m "feat: log ApiUsage for each image generation call"
```

---

### Task 6: App — Update AI Fill to Return Metadata

**Files:**
- Modify: `src/lib/ai-fill.ts`
- Modify: `src/app/api/attributes/generate/route.ts`

- [ ] **Step 1: Update `generateAttributeSuggestions` return type in `ai-fill.ts`**

Add a return type interface (after `AiFillSuggestion`, around line 22):

```typescript
export interface AiFillResult {
  suggestions: AiFillSuggestion[];
  responseJson: Record<string, unknown>;
  durationMs: number;
}
```

Change the function signature (line 183) from `Promise<AiFillSuggestion[]>` to `Promise<AiFillResult>`.

Add timer after the API key check (after line 187):

```typescript
  const startTime = Date.now();
```

Capture `durationMs` after the fetch, and store the full response. Change (line 227):

```typescript
  const data = await res.json();
  const durationMs = Date.now() - startTime;
```

Change the return statement (lines 253-258) to return `AiFillResult`:

```typescript
  return {
    suggestions,
    responseJson: data as Record<string, unknown>,
    durationMs,
  };
```

Also add `durationMs` capture to the error path. Wrap the error response handling (lines 217-225):

```typescript
  if (!res.ok) {
    const durationMs = Date.now() - startTime;
    const errorBody = await res.text().catch(() => "");
    console.error(`[ai-fill] Gemini HTTP ${res.status}:`, errorBody);
    throw Object.assign(
      new Error(
        res.status === 429
          ? "Rate limited — please try again in a moment"
          : "Failed to generate attribute suggestions"
      ),
      { status: res.status, durationMs, errorBody },
    );
  }
```

- [ ] **Step 2: Update the AI Fill API route to write `ApiUsage`**

In `src/app/api/attributes/generate/route.ts`, add imports:

```typescript
import { parseGeminiUsage, classifyError } from "@/lib/api-usage";
import { API_USAGE_TYPE } from "@/lib/constants";
```

Update the call to `generateAttributeSuggestions` (line 67) to destructure the result:

```typescript
    const { suggestions, responseJson, durationMs } = await generateAttributeSuggestions(config, selections, prompt);

    // Log API usage (best-effort)
    try {
      const parsed = parseGeminiUsage(responseJson, "gemini-2.5-flash");
      await prisma.apiUsage.create({
        data: {
          userId: session.user.id,
          type: API_USAGE_TYPE.AI_FILL,
          provider: "gemini",
          model: "gemini-2.5-flash",
          promptTokens: parsed.promptTokens,
          candidatesTokens: parsed.candidatesTokens,
          totalTokens: parsed.totalTokens,
          estimatedCostUsd: parsed.estimatedCostUsd,
          success: true,
          durationMs,
          responseMetadata: parsed.responseMetadata,
        },
      });
    } catch (logErr) {
      console.error("[api-usage] Failed to log AI Fill usage:", logErr);
    }

    return NextResponse.json({ suggestions });
```

Update the error catch block (lines 70-75) to log failed API calls:

```typescript
  } catch (err) {
    console.error("[ai-fill] Generation failed:", err);

    // Log failed API usage (best-effort)
    try {
      const errObj = err as Error & { status?: number; durationMs?: number; errorBody?: string };
      const errorType = classifyError(errObj.status ?? 0, errObj.message);
      await prisma.apiUsage.create({
        data: {
          userId: session.user.id,
          type: API_USAGE_TYPE.AI_FILL,
          provider: "gemini",
          model: "gemini-2.5-flash",
          success: false,
          durationMs: errObj.durationMs ?? null,
          errorCode: errObj.status ? String(errObj.status) : null,
          errorType,
          errorMessage: errObj.message,
        },
      });
    } catch (logErr) {
      console.error("[api-usage] Failed to log AI Fill error:", logErr);
    }

    const message =
      err instanceof Error ? err.message : "Failed to generate suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai-fill.ts src/app/api/attributes/generate/route.ts
git commit -m "feat: log ApiUsage for AI Fill operations"
```

---

### Task 7: App — Update AI Edit Route to Log Usage

**Files:**
- Modify: `src/app/api/attributes/edit/route.ts`

- [ ] **Step 1: Add imports**

```typescript
import { parseGeminiUsage, classifyError } from "@/lib/api-usage";
import { API_USAGE_TYPE } from "@/lib/constants";
```

- [ ] **Step 2: Add timer and capture response metadata**

Add timer after the `reserveAiFillCredits` block (before the try at line 84):

```typescript
    const startTime = Date.now();
```

After `const geminiData = await res.json();` (line 119), capture duration:

```typescript
    const durationMs = Date.now() - startTime;
```

- [ ] **Step 3: Log successful API usage**

After the response parsing succeeds (before the return on line 161), add:

```typescript
    // Log API usage (best-effort)
    try {
      const parsed = parseGeminiUsage(geminiData as Record<string, unknown>, "gemini-2.5-flash");
      await prisma.apiUsage.create({
        data: {
          userId: session.user.id,
          type: API_USAGE_TYPE.AI_EDIT,
          provider: "gemini",
          model: "gemini-2.5-flash",
          promptTokens: parsed.promptTokens,
          candidatesTokens: parsed.candidatesTokens,
          totalTokens: parsed.totalTokens,
          estimatedCostUsd: parsed.estimatedCostUsd,
          success: true,
          durationMs,
          responseMetadata: parsed.responseMetadata,
        },
      });
    } catch (logErr) {
      console.error("[api-usage] Failed to log AI Edit usage:", logErr);
    }
```

- [ ] **Step 4: Log failed API usage in catch block**

Update the catch block (lines 162-166) to also log the error:

```typescript
  } catch (err) {
    console.error("[ai-edit] Failed:", err);

    try {
      const errObj = err as Error & { status?: number; durationMs?: number };
      const durationMs = errObj.durationMs ?? (Date.now() - (startTime ?? Date.now()));
      const errorType = classifyError(errObj.status ?? 0, errObj.message);
      await prisma.apiUsage.create({
        data: {
          userId: session.user.id,
          type: API_USAGE_TYPE.AI_EDIT,
          provider: "gemini",
          model: "gemini-2.5-flash",
          success: false,
          durationMs,
          errorCode: errObj.status ? String(errObj.status) : null,
          errorType,
          errorMessage: errObj.message,
        },
      });
    } catch (logErr) {
      console.error("[api-usage] Failed to log AI Edit error:", logErr);
    }

    const message = err instanceof Error ? err.message : "Failed to edit attributes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
```

Note: `startTime` needs to be declared in the outer scope (before the try block) for the error handler to access it. Move it to right after `reserveAiFillCredits`.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/attributes/edit/route.ts
git commit -m "feat: log ApiUsage for AI Edit operations"
```

---

### Task 8: Access Control — Proxy, Robots, Admin Layout

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/app/robots.ts`
- Create: `src/app/admin/layout.tsx`

- [ ] **Step 1: Add `/admin` to protected routes in `src/proxy.ts`**

Update `protectedRoutes` (line 4):

```typescript
const protectedRoutes = ["/dashboard", "/create", "/editor", "/admin"];
```

Update the `matcher` (line 29):

```typescript
export const config = {
  matcher: ["/dashboard/:path*", "/create/:path*", "/editor/:path*", "/admin/:path*"],
};
```

- [ ] **Step 2: Add `/admin` to robots disallow in `src/app/robots.ts`**

Add `"/admin"` to the disallow array (after `"/settings"`, line 14):

```typescript
        disallow: [
          "/dashboard",
          "/create",
          "/editor",
          "/settings",
          "/admin",
          "/sign-in",
          "/sign-up",
          "/api/",
        ],
```

- [ ] **Step 3: Create admin layout with email gate**

Create `src/app/admin/layout.tsx`:

```typescript
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  if (!email || !ADMIN_EMAILS.includes(email)) {
    notFound();
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts src/app/robots.ts src/app/admin/layout.tsx
git commit -m "feat: add admin route protection with email gate"
```

---

### Task 9: Admin Dashboard — Query Functions

**Files:**
- Create: `src/app/admin/lib/queries.ts`

All Prisma queries for the dashboard, organized by section. Server-side only.

- [ ] **Step 1: Create `src/app/admin/lib/queries.ts`**

```typescript
import { prisma } from "@/lib/prisma";
import { PLAN_PRICES } from "@/lib/constants";

// ──────────────────────────────────────────
// Revenue queries
// ──────────────────────────────────────────

export async function getSubscribersByTier() {
  const result = await prisma.user.groupBy({
    by: ["tier"],
    _count: { id: true },
  });
  return result.map((r) => ({ tier: r.tier, count: r._count.id }));
}

export async function getEstimatedMRR() {
  const subscribers = await prisma.user.groupBy({
    by: ["tier"],
    where: { subscriptionStatus: "active" },
    _count: { id: true },
  });
  return subscribers.reduce((total, s) => {
    const price = PLAN_PRICES[s.tier] ?? 0;
    return total + price * s._count.id;
  }, 0);
}

// Maps credit amounts from CREDIT_PACKS to their dollar prices
const CREDIT_AMOUNT_TO_PRICE: Record<number, number> = {
  50: 5, 100: 9, 250: 20, 500: 35,
};

export async function getCreditPackRevenue(startDate: Date, endDate: Date) {
  const pools = await prisma.creditPool.findMany({
    where: {
      source: "PURCHASE",
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { originalAmount: true, createdAt: true },
  });
  return pools.map((p) => ({
    credits: p.originalAmount,
    dollarAmount: CREDIT_AMOUNT_TO_PRICE[p.originalAmount] ?? 0,
    createdAt: p.createdAt,
  }));
}

export async function getCreditPackRevenueTotal(startDate: Date, endDate: Date) {
  const packs = await getCreditPackRevenue(startDate, endDate);
  return packs.reduce((sum, p) => sum + p.dollarAmount, 0);
}

// ──────────────────────────────────────────
// AI Cost queries
// ──────────────────────────────────────────

export async function getApiCostsByType(startDate: Date, endDate: Date) {
  const result = await prisma.apiUsage.groupBy({
    by: ["type"],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum: { estimatedCostUsd: true, promptTokens: true, candidatesTokens: true, totalTokens: true },
    _count: { id: true },
  });
  return result.map((r) => ({
    type: r.type,
    count: r._count.id,
    totalCostUsd: r._sum.estimatedCostUsd?.toNumber() ?? 0,
    promptTokens: r._sum.promptTokens ?? 0,
    candidatesTokens: r._sum.candidatesTokens ?? 0,
    totalTokens: r._sum.totalTokens ?? 0,
  }));
}

export async function getApiCostsByModel(startDate: Date, endDate: Date) {
  const result = await prisma.apiUsage.groupBy({
    by: ["model"],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum: { estimatedCostUsd: true, totalTokens: true },
    _count: { id: true },
  });
  return result.map((r) => ({
    model: r.model,
    count: r._count.id,
    totalCostUsd: r._sum.estimatedCostUsd?.toNumber() ?? 0,
    totalTokens: r._sum.totalTokens ?? 0,
  }));
}

export async function getRetryCost(startDate: Date, endDate: Date) {
  const result = await prisma.apiUsage.aggregate({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      attempt: { gt: 1 },
    },
    _sum: { estimatedCostUsd: true },
    _count: { id: true },
  });
  return {
    totalCostUsd: result._sum.estimatedCostUsd?.toNumber() ?? 0,
    count: result._count.id,
  };
}

export async function getDailyCosts(startDate: Date, endDate: Date) {
  const usages = await prisma.apiUsage.findMany({
    where: { createdAt: { gte: startDate, lte: endDate } },
    select: { type: true, estimatedCostUsd: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap = new Map<string, Record<string, number>>();
  for (const u of usages) {
    const day = u.createdAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(day) ?? { GENERATION: 0, AI_FILL: 0, AI_EDIT: 0 };
    entry[u.type] = (entry[u.type] ?? 0) + (u.estimatedCostUsd?.toNumber() ?? 0);
    dailyMap.set(day, entry);
  }

  return Array.from(dailyMap.entries()).map(([date, costs]) => ({ date, ...costs }));
}

export async function getTotalCreditsConsumed(startDate: Date, endDate: Date) {
  const result = await prisma.creditTransaction.aggregate({
    where: {
      type: "RESERVE",
      createdAt: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });
  return Math.abs(result._sum.amount ?? 0);
}

// ──────────────────────────────────────────
// Anomaly queries
// ──────────────────────────────────────────

export async function getMoneyLeaks() {
  // Generations where ALL ApiUsage rows succeeded but a REFUND exists
  const refundedGenerations = await prisma.creditTransaction.findMany({
    where: { type: "REFUND", generationId: { not: null } },
    select: { generationId: true },
    distinct: ["generationId"],
  });

  const leaks = [];
  for (const { generationId } of refundedGenerations) {
    if (!generationId) continue;
    const failedCalls = await prisma.apiUsage.count({
      where: { generationId, success: false },
    });
    if (failedCalls === 0) {
      const successCalls = await prisma.apiUsage.count({
        where: { generationId, success: true },
      });
      if (successCalls > 0) leaks.push(generationId);
    }
  }
  return leaks;
}

export async function getUserOvercharged() {
  // Generations that FAILED with no REFUND transaction
  const failedGens = await prisma.generation.findMany({
    where: { status: "FAILED", creditCost: { gt: 0 } },
    select: { id: true, creditCost: true, createdAt: true },
  });

  const overcharged = [];
  for (const gen of failedGens) {
    const refundCount = await prisma.creditTransaction.count({
      where: { generationId: gen.id, type: "REFUND" },
    });
    if (refundCount === 0) overcharged.push(gen);
  }
  return overcharged;
}

export async function getDuplicateRefunds() {
  const result = await prisma.creditTransaction.groupBy({
    by: ["generationId"],
    where: { type: "REFUND", generationId: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  return result.map((r) => ({
    generationId: r.generationId,
    refundCount: r._count.id,
  }));
}

export async function getCreditBalanceDesyncs() {
  // Batch query comparing creditBalance vs sum of pool remaining
  const users = await prisma.$queryRaw<
    Array<{ id: string; email: string; creditBalance: number; poolTotal: bigint }>
  >`
    SELECT u.id, u.email, u."creditBalance", COALESCE(SUM(cp.remaining), 0) AS "poolTotal"
    FROM "User" u
    LEFT JOIN "CreditPool" cp ON cp."userId" = u.id AND (cp."expiresAt" IS NULL OR cp."expiresAt" > NOW())
    GROUP BY u.id, u.email, u."creditBalance"
    HAVING u."creditBalance" != COALESCE(SUM(cp.remaining), 0)
  `;
  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    creditBalance: u.creditBalance,
    poolTotal: Number(u.poolTotal),
  }));
}

export async function getOrphanedProcessing() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const stuck = await prisma.generation.findMany({
    where: {
      status: "PROCESSING",
      createdAt: { lt: thirtyMinAgo },
    },
    select: { id: true, createdAt: true, projectId: true },
  });

  const orphaned = [];
  for (const gen of stuck) {
    const usageCount = await prisma.apiUsage.count({
      where: { generationId: gen.id },
    });
    if (usageCount === 0) orphaned.push(gen);
  }
  return orphaned;
}

export async function getCancellationRaces() {
  // Generations FAILED (cancelled) but have successful API calls after the refund timestamp.
  // Generation has no updatedAt, so we use the REFUND CreditTransaction timestamp as proxy.
  const cancelledGens = await prisma.generation.findMany({
    where: { status: "FAILED", errorMessage: { contains: "cancel" } },
    select: { id: true, createdAt: true },
  });

  const races = [];
  for (const gen of cancelledGens) {
    // Find the cancellation refund timestamp
    const refund = await prisma.creditTransaction.findFirst({
      where: { generationId: gen.id, type: "REFUND" },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (!refund) continue;

    const lateSuccess = await prisma.apiUsage.count({
      where: {
        generationId: gen.id,
        success: true,
        createdAt: { gt: refund.createdAt },
      },
    });
    if (lateSuccess > 0) races.push(gen.id);
  }
  return races;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/lib/queries.ts
git commit -m "feat: add admin dashboard query functions"
```

---

### Task 10: Admin Dashboard — Install Recharts and Create Chart Components

**Files:**
- Create: `src/app/admin/components/charts.tsx`

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Create `src/app/admin/components/charts.tsx`**

Thin client wrappers for Recharts. These are `"use client"` components that receive data as props.

```typescript
"use client";

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface ChartProps {
  data: Array<Record<string, unknown>>;
  className?: string;
}

interface LineChartProps extends ChartProps {
  lines: { key: string; color: string; label: string }[];
  xKey: string;
}

export function SimpleLineChart({ data, lines, xKey, className }: LineChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--color-popover)", border: "1px solid var(--color-border)" }}
          />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              name={line.label}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarChartProps extends ChartProps {
  bars: { key: string; color: string; label: string }[];
  xKey: string;
}

export function SimpleBarChart({ data, bars, xKey, className }: BarChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--color-popover)", border: "1px solid var(--color-border)" }}
          />
          <Legend />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.label} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StackedBarChartProps extends ChartProps {
  bars: { key: string; color: string; label: string }[];
  xKey: string;
}

export function SimpleStackedBarChart({ data, bars, xKey, className }: StackedBarChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--color-popover)", border: "1px solid var(--color-border)" }}
          />
          <Legend />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.label} stackId="a" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DonutChartProps {
  data: { name: string; value: number }[];
  className?: string;
}

export function SimpleDonutChart({ data, className }: DonutChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            nameKey="name"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/components/charts.tsx package.json package-lock.json
git commit -m "feat: add Recharts and chart wrapper components"
```

---

### Task 11: Admin Dashboard — Section Components

**Files:**
- Create: `src/app/admin/components/metric-card.tsx`
- Create: `src/app/admin/components/revenue-section.tsx`
- Create: `src/app/admin/components/cost-section.tsx`
- Create: `src/app/admin/components/profitability-section.tsx`
- Create: `src/app/admin/components/anomaly-section.tsx`

All section components are **server components** that call query functions and pass data to chart wrappers.

- [ ] **Step 1: Create shared `metric-card.tsx`**

```typescript
interface MetricCardProps {
  label: string;
  value: string;
  highlight?: "green" | "red";
}

export function MetricCard({ label, value, highlight }: MetricCardProps) {
  const colorClass = highlight === "green" ? "text-green-600" : highlight === "red" ? "text-red-600" : "";
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create `revenue-section.tsx`**

```typescript
import { getSubscribersByTier, getEstimatedMRR, getCreditPackRevenueTotal } from "../lib/queries";
import { SimpleDonutChart } from "./charts";
import { MetricCard } from "./metric-card";

interface RevenueSectionProps {
  startDate: Date;
  endDate: Date;
}

export async function RevenueSection({ startDate, endDate }: RevenueSectionProps) {
  const [subscribers, mrr, creditPackRevenue] = await Promise.all([
    getSubscribersByTier(),
    getEstimatedMRR(),
    getCreditPackRevenueTotal(startDate, endDate),
  ]);

  const tierData = subscribers.map((s) => ({ name: s.tier, value: s.count }));
  const totalUsers = subscribers.reduce((sum, s) => sum + s.count, 0);
  const totalRevenue = mrr + creditPackRevenue;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Revenue Overview</h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Users" value={totalUsers.toLocaleString()} />
        <MetricCard label="Estimated MRR" value={`$${mrr.toFixed(2)}`} />
        <MetricCard label="Credit Pack Revenue" value={`$${creditPackRevenue.toFixed(2)}`} />
        <MetricCard label="Total Est. Revenue" value={`$${totalRevenue.toFixed(2)}`} />
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-2">Subscribers by Tier</h3>
        <SimpleDonutChart data={tierData} />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create `cost-section.tsx`**

```typescript
import { getApiCostsByType, getApiCostsByModel, getRetryCost, getDailyCosts, getTotalCreditsConsumed } from "../lib/queries";
import { SimpleStackedBarChart, SimpleBarChart } from "./charts";
import { MetricCard } from "./metric-card";

interface CostSectionProps {
  startDate: Date;
  endDate: Date;
}

export async function CostSection({ startDate, endDate }: CostSectionProps) {
  const [byType, byModel, retry, dailyCosts, creditsConsumed] = await Promise.all([
    getApiCostsByType(startDate, endDate),
    getApiCostsByModel(startDate, endDate),
    getRetryCost(startDate, endDate),
    getDailyCosts(startDate, endDate),
    getTotalCreditsConsumed(startDate, endDate),
  ]);

  const totalCost = byType.reduce((sum, t) => sum + t.totalCostUsd, 0);
  const costPerCredit = creditsConsumed > 0 ? totalCost / creditsConsumed : 0;

  const modelChartData = byModel.map((m) => ({
    model: m.model.replace("gemini-", ""),
    cost: m.totalCostUsd,
    tokens: m.totalTokens,
  }));

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">AI Cost Breakdown</h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total API Cost" value={`$${totalCost.toFixed(4)}`} />
        <MetricCard label="Cost per Credit" value={`$${costPerCredit.toFixed(4)}`} />
        <MetricCard label="Retry Cost" value={`$${retry.totalCostUsd.toFixed(4)}`} />
        <MetricCard label="Total API Calls" value={byType.reduce((s, t) => s + t.count, 0).toLocaleString()} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {byType.map((t) => (
          <div key={t.type} className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{t.type}</p>
            <p className="text-lg font-bold">${t.totalCostUsd.toFixed(4)}</p>
            <p className="text-xs text-muted-foreground">{t.count} calls / {t.totalTokens.toLocaleString()} tokens</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-2">Cost by Day</h3>
          <SimpleStackedBarChart
            data={dailyCosts}
            xKey="date"
            bars={[
              { key: "GENERATION", color: "#3b82f6", label: "Generation" },
              { key: "AI_FILL", color: "#10b981", label: "AI Fill" },
              { key: "AI_EDIT", color: "#f59e0b", label: "AI Edit" },
            ]}
          />
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-2">Token Usage by Model</h3>
          <SimpleBarChart
            data={modelChartData}
            xKey="model"
            bars={[{ key: "tokens", color: "#8b5cf6", label: "Tokens" }]}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `profitability-section.tsx`**

```typescript
import { getApiCostsByType, getEstimatedMRR, getCreditPackRevenueTotal, getDailyCosts, getTotalCreditsConsumed } from "../lib/queries";
import { SimpleLineChart } from "./charts";
import { MetricCard } from "./metric-card";

interface ProfitabilitySectionProps {
  startDate: Date;
  endDate: Date;
}

export async function ProfitabilitySection({ startDate, endDate }: ProfitabilitySectionProps) {
  const [costs, mrr, creditPackRevenue, dailyCosts, creditsConsumed] = await Promise.all([
    getApiCostsByType(startDate, endDate),
    getEstimatedMRR(),
    getCreditPackRevenueTotal(startDate, endDate),
    getDailyCosts(startDate, endDate),
    getTotalCreditsConsumed(startDate, endDate),
  ]);

  const totalCost = costs.reduce((sum, c) => sum + c.totalCostUsd, 0);
  const totalRevenue = mrr + creditPackRevenue;
  const grossProfit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const costPerCredit = creditsConsumed > 0 ? totalCost / creditsConsumed : 0;

  // Build daily profit data for chart
  const profitChartData = dailyCosts.map((d) => {
    const dayCost = (d.GENERATION ?? 0) + (d.AI_FILL ?? 0) + (d.AI_EDIT ?? 0);
    return { date: d.date, cost: dayCost };
  });

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Profitability</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Note: Revenue is estimated (current active subscribers x plan prices + credit pack purchases in selected period). For exact revenue, check DodoPayments dashboard.
      </p>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <MetricCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} />
        <MetricCard label="API Costs" value={`$${totalCost.toFixed(4)}`} />
        <MetricCard label="Gross Profit" value={`$${grossProfit.toFixed(2)}`} highlight={grossProfit >= 0 ? "green" : "red"} />
        <MetricCard label="Margin" value={`${marginPct.toFixed(1)}%`} highlight={marginPct >= 0 ? "green" : "red"} />
        <MetricCard label="Cost per Credit" value={`$${costPerCredit.toFixed(4)}`} />
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-2">Daily API Costs</h3>
        <SimpleLineChart
          data={profitChartData}
          xKey="date"
          lines={[
            { key: "cost", color: "#ef4444", label: "API Cost" },
          ]}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create `anomaly-section.tsx`**

```typescript
import {
  getMoneyLeaks,
  getUserOvercharged,
  getDuplicateRefunds,
  getCreditBalanceDesyncs,
  getOrphanedProcessing,
  getCancellationRaces,
} from "../lib/queries";

export async function AnomalySection() {
  const [leaks, overcharged, dupes, desyncs, orphaned, races] = await Promise.all([
    getMoneyLeaks(),
    getUserOvercharged(),
    getDuplicateRefunds(),
    getCreditBalanceDesyncs(),
    getOrphanedProcessing(),
    getCancellationRaces(),
  ]);

  const flags = [
    { label: "Money Leaks", description: "API succeeded but credits refunded", count: leaks.length, items: leaks, severity: "red" as const },
    { label: "User Overcharged", description: "Generation failed, no refund", count: overcharged.length, items: overcharged, severity: "red" as const },
    { label: "Duplicate Refunds", description: "Multiple refunds for same generation", count: dupes.length, items: dupes, severity: "amber" as const },
    { label: "Credit Desync", description: "creditBalance != pool total", count: desyncs.length, items: desyncs, severity: "red" as const },
    { label: "Orphaned Processing", description: "Stuck in PROCESSING >30min, no API calls", count: orphaned.length, items: orphaned, severity: "amber" as const },
    { label: "Cancellation Races", description: "Cancelled but API succeeded after", count: races.length, items: races, severity: "amber" as const },
  ];

  const hasAnomalies = flags.some((f) => f.count > 0);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Anomaly Flags</h2>

      {!hasAnomalies && (
        <p className="text-sm text-muted-foreground">No anomalies detected.</p>
      )}

      <div className="space-y-3">
        {flags.map((flag) => (
          <div key={flag.label} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{flag.label}</span>
                <span className="text-sm text-muted-foreground ml-2">{flag.description}</span>
              </div>
              <span className={`font-mono font-bold ${
                flag.count === 0 ? "text-green-600" : flag.severity === "red" ? "text-red-600" : "text-amber-600"
              }`}>
                {flag.count}
              </span>
            </div>
            {flag.count > 0 && (
              <details className="mt-2">
                <summary className="text-sm cursor-pointer text-muted-foreground">Show details</summary>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(flag.items, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/components/
git commit -m "feat: add admin dashboard section components"
```

---

### Task 12: Admin Dashboard — Main Page

**Files:**
- Create: `src/app/admin/page.tsx`

Server component that renders all sections with a date range picker.

- [ ] **Step 1: Create `src/app/admin/page.tsx`**

```typescript
import { Suspense } from "react";
import { RevenueSection } from "./components/revenue-section";
import { CostSection } from "./components/cost-section";
import { ProfitabilitySection } from "./components/profitability-section";
import { AnomalySection } from "./components/anomaly-section";

interface AdminPageProps {
  searchParams: Promise<{ start?: string; end?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;

  // Default to current month
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const startDate = params.start ? new Date(params.start) : defaultStart;
  const endDate = params.end ? new Date(params.end) : defaultEnd;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <DateRangeForm start={startDate} end={endDate} />
      </div>

      <div className="space-y-10">
        <Suspense fallback={<SectionSkeleton />}>
          <RevenueSection startDate={startDate} endDate={endDate} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <CostSection startDate={startDate} endDate={endDate} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <ProfitabilitySection startDate={startDate} endDate={endDate} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <AnomalySection />
        </Suspense>
      </div>
    </div>
  );
}

function DateRangeForm({ start, end }: { start: Date; end: Date }) {
  return (
    <form className="flex items-center gap-2" method="get">
      <input
        type="date"
        name="start"
        defaultValue={start.toISOString().slice(0, 10)}
        className="rounded border px-2 py-1 text-sm"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <input
        type="date"
        name="end"
        defaultValue={end.toISOString().slice(0, 10)}
        className="rounded border px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
      >
        Apply
      </button>
    </form>
  );
}

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded bg-muted" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add admin dashboard page with date range picker"
```

---

### Task 13: Build Verification

- [ ] **Step 1: Type-check both packages**

```bash
npx tsc --noEmit
cd worker && npx tsc --noEmit
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

Note: The build requires `ADMIN_EMAILS` env var to be set (can be empty for build). The admin layout reads it at runtime, so an empty value during build is fine.

- [ ] **Step 4: Fix any issues found**

Address any type errors, lint violations, or build failures.

- [ ] **Step 5: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build issues"
```
