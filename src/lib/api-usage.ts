import { Prisma } from "@/generated/prisma/client";
import { GEMINI_PRICING } from "./constants";

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
