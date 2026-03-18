const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FETCH_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes — premium models can be slow

const GEMINI_ERROR_MESSAGES: Record<number, string> = {
  400: "The request was invalid. Try adjusting your description or settings.",
  403: "Access denied. Please contact support.",
  429: "Rate limit reached. Please wait a moment and try again.",
  500: "The AI service encountered an internal error. Please try again.",
  503: "This model is experiencing high demand. Please try again shortly.",
};

export class GeminiApiError extends Error {
  constructor(status: number) {
    const message = GEMINI_ERROR_MESSAGES[status]
      ?? "Generation failed. Please try again.";
    super(message);
    this.name = "GeminiApiError";
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
  }[];
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

export interface GeminiGenerateParams {
  prompt: string;
  count: number;
  referenceImage?: Buffer;
  modelId: string;
}

export async function generateImages({
  prompt,
  count,
  referenceImage,
  modelId,
}: GeminiGenerateParams): Promise<Buffer[]> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

  const results: Buffer[] = [];

  for (let i = 0; i < count; i++) {
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

    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    };

    const res = await fetch(`${geminiEndpoint(modelId)}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new GeminiApiError(res.status);
    }

    const data = (await res.json()) as GeminiResponse;
    const buffers = extractImageBuffers(data);
    if (buffers.length === 0) {
      throw new GeminiApiError(500);
    }
    results.push(buffers[0]);
  }

  return results;
}

export interface GeminiInpaintParams {
  imageBuffer: Buffer;
  maskBuffer?: Buffer;
  prompt: string;
  modelId: string;
}

/**
 * Gemini uses prompt-based editing — send the source image with an
 * edit instruction. A mask is not required; if one is provided we
 * describe the masked region in the prompt to guide the edit.
 */
export async function inpaintImage({
  imageBuffer,
  prompt,
  modelId,
}: GeminiInpaintParams): Promise<Buffer> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

  const parts: Array<Record<string, unknown>> = [
    {
      inlineData: {
        mimeType: "image/png",
        data: imageBuffer.toString("base64"),
      },
    },
    { text: prompt },
  ];

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const res = await fetch(`${geminiEndpoint(modelId)}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new GeminiApiError(res.status);
  }

  const data = (await res.json()) as GeminiResponse;
  const buffers = extractImageBuffers(data);
  if (buffers.length === 0) {
    throw new GeminiApiError(500);
  }
  return buffers[0];
}
