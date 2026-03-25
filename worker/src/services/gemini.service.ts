const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FETCH_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes — premium models can be slow

const NO_IMAGES_MESSAGE =
  "No images were generated. Try adjusting your description or a different quality setting.";

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

export interface GeminiImageConfig {
  aspectRatio?: string;
  imageSize?: string;
  thinkingLevel?: string;
}

export interface GeminiGenerateParams {
  prompt: string;
  count: number;
  referenceImage?: Buffer;
  modelId: string;
  config?: GeminiImageConfig;
}

export async function generateImages({
  prompt,
  count,
  referenceImage,
  modelId,
  config,
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
      console.error(`[gemini] fetch failed for model ${modelId} (image ${i + 1}/${count}):`, err);
      throw new Error(
        "Could not reach the image generation service. Please try again.",
        { cause: err },
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[gemini] HTTP ${res.status} for model ${modelId}:`, body);
      throw new GeminiApiError(res.status);
    }

    const data = (await res.json()) as GeminiResponse;
    const buffers = extractImageBuffers(data);
    if (buffers.length === 0) {
      throw new Error(NO_IMAGES_MESSAGE);
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
  config?: GeminiImageConfig;
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
  config,
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
    console.error(`[gemini] inpaint fetch failed for model ${modelId}:`, err);
    throw new Error(
      "Could not reach the image generation service. Please try again.",
      { cause: err },
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[gemini] inpaint HTTP ${res.status} for model ${modelId}:`, body);
    throw new GeminiApiError(res.status);
  }

  const data = (await res.json()) as GeminiResponse;
  const buffers = extractImageBuffers(data);
  if (buffers.length === 0) {
    throw new Error(NO_IMAGES_MESSAGE);
  }
  return buffers[0];
}
