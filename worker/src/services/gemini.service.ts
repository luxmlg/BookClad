import { UnrecoverableError } from "bullmq";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FETCH_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes — premium models can be slow

const GEMINI_ERROR_MESSAGES: Record<number, string> = {
  400: "Something about your request was invalid. Try adjusting your description or settings.",
  401: "Image generation service authentication failed. Please contact support.",
  403: "Access to the image generation service was denied. Please contact support.",
  404: "The image generation service is temporarily unavailable. Try a different quality setting or try again later.",
  429: "Too many requests. Please wait a moment and try again, or try a different quality setting.",
  500: "Image generation hit an unexpected error. Please try again or use a different quality setting.",
  503: "Image generation is experiencing high demand. Try a different quality setting or wait a moment and try again.",
};

export class GeminiApiError extends Error {
  status: number;
  constructor(status: number) {
    const message = GEMINI_ERROR_MESSAGES[status]
      ?? "Generation failed. Please try again.";
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

export class SafetyFilterError extends UnrecoverableError {
  constructor(message?: string) {
    super(message ?? "Content blocked by safety filter. Try adjusting your description.");
    this.name = "SafetyFilterError";
  }
}

function geminiEndpoint(modelId: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
}

export function isGeminiAvailable(): boolean {
  return !!GEMINI_API_KEY;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

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

function extractImageBuffers(response: GeminiResponse): Buffer[] {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("Gemini returned no content parts");

  const buffers: Buffer[] = [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      buffers.push(Buffer.from(part.inlineData.data, "base64"));
    }
  }
  return buffers;
}

export interface GeminiImageConfig {
  aspectRatio?: string;
  imageSize?: string;
  thinkingLevel?: string;
}

export interface GenerateSingleImageParams {
  prompt: string;
  referenceImage?: Buffer;
  modelId: string;
  config?: GeminiImageConfig;
}

export interface GenerationResult {
  imageBuffer: Buffer;
  responseJson: Record<string, unknown>;
  durationMs: number;
}

export async function generateSingleImage({
  prompt,
  referenceImage,
  modelId,
  config,
}: GenerateSingleImageParams): Promise<GenerationResult> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

  const startTime = Date.now();

  const parts: Array<Record<string, unknown>> = [];

  if (referenceImage) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: referenceImage.toString("base64"),
      },
    });
  }

  parts.push({ text: prompt });

  const generationConfig: Record<string, unknown> = {
    responseModalities: ["IMAGE", "TEXT"],
  };

  if (config?.aspectRatio || config?.imageSize) {
    const imageConfig: Record<string, string> = {};
    if (config.aspectRatio) imageConfig.aspectRatio = config.aspectRatio;
    if (config.imageSize) imageConfig.imageSize = config.imageSize;
    generationConfig.imageConfig = imageConfig;
  }

  if (config?.thinkingLevel) {
    generationConfig.thinkingConfig = { thinkingLevel: config.thinkingLevel };
  }

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig,
  };

  let res: Response;
  try {
    res = await fetch(`${geminiEndpoint(modelId)}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[gemini] fetch failed for model ${modelId}:`, err);
    throw Object.assign(
      new Error("Could not reach the image generation service. Please try again.", { cause: err }),
      { durationMs },
    );
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    const durationMs = Date.now() - startTime;
    console.error(`[gemini] HTTP ${res.status} for model ${modelId}:`, errBody);

    let errorJson: Record<string, unknown> | undefined;
    try { errorJson = JSON.parse(errBody); } catch { /* ignore */ }

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

  const data = (await res.json()) as GeminiResponse;
  const durationMs = Date.now() - startTime;

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
}

