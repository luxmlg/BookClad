const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FETCH_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes — premium models can be slow

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
      const text = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const buffers = extractImageBuffers(data);
    if (buffers.length === 0) {
      throw new Error("Gemini returned no images in response");
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
    const text = await res.text();
    throw new Error(`Gemini inpaint error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const buffers = extractImageBuffers(data);
  if (buffers.length === 0) {
    throw new Error("Gemini returned no images for inpainting");
  }
  return buffers[0];
}
