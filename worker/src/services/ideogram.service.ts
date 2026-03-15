const IDEOGRAM_API_KEY = process.env.IDEOGRAM_API_KEY;

const IDEOGRAM_GENERATE_URL = "https://api.ideogram.ai/v1/ideogram-v3/generate";
const IDEOGRAM_EDIT_URL = "https://api.ideogram.ai/edit";
const IDEOGRAM_ASPECT_RATIO = "10x16";
const IDEOGRAM_RENDERING_SPEED = "DEFAULT";
const IDEOGRAM_MODEL_VERSION = "V_3";
const IDEOGRAM_NEGATIVE_PROMPT = "text, letters, words, watermark, borders, frames";

export function isIdeogramAvailable(): boolean {
  return !!IDEOGRAM_API_KEY;
}

interface IdeogramImageResponse {
  data?: { url?: string }[];
}

async function downloadIdeogramImage(result: IdeogramImageResponse): Promise<Buffer> {
  const imageUrl = result.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("No image URL returned from Ideogram");
  }
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error("Failed to download Ideogram result");
  return Buffer.from(await imgRes.arrayBuffer());
}

export interface IdeogramGenerateParams {
  prompt: string;
  count: number;
}

export async function ideogramGenerate({
  prompt,
  count,
}: IdeogramGenerateParams): Promise<Buffer[]> {
  if (!IDEOGRAM_API_KEY) {
    throw new Error("IDEOGRAM_API_KEY is not configured");
  }

  const results: Buffer[] = [];

  for (let i = 0; i < count; i++) {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("aspect_ratio", IDEOGRAM_ASPECT_RATIO);
    formData.append("rendering_speed", IDEOGRAM_RENDERING_SPEED);
    formData.append("num_images", "1");
    formData.append("negative_prompt", IDEOGRAM_NEGATIVE_PROMPT);

    const response = await fetch(IDEOGRAM_GENERATE_URL, {
      method: "POST",
      headers: { "Api-Key": IDEOGRAM_API_KEY },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ideogram generate error (${response.status}): ${text}`);
    }

    const result = (await response.json()) as IdeogramImageResponse;
    results.push(await downloadIdeogramImage(result));
  }

  return results;
}

export interface IdeogramInpaintParams {
  imageBuffer: Buffer;
  maskBuffer: Buffer;
  prompt: string;
}

export async function ideogramInpaint({
  imageBuffer,
  maskBuffer,
  prompt,
}: IdeogramInpaintParams): Promise<Buffer> {
  if (!IDEOGRAM_API_KEY) {
    throw new Error("IDEOGRAM_API_KEY is not configured");
  }

  const formData = new FormData();
  formData.append(
    "image_file",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }),
    "image.png"
  );
  formData.append(
    "mask",
    new Blob([new Uint8Array(maskBuffer)], { type: "image/png" }),
    "mask.png"
  );
  formData.append("prompt", prompt);
  formData.append("model", IDEOGRAM_MODEL_VERSION);

  const response = await fetch(IDEOGRAM_EDIT_URL, {
    method: "POST",
    headers: { "Api-Key": IDEOGRAM_API_KEY },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ideogram inpaint error (${response.status}): ${text}`);
  }

  const result = (await response.json()) as IdeogramImageResponse;
  return downloadIdeogramImage(result);
}
