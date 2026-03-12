import OpenAI from "openai";
import { toFile } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface GenerateImagesParams {
  prompt: string;
  count: number;
  referenceImage?: Buffer;
}

async function imageDataToBuffer(
  item: OpenAI.Images.Image
): Promise<Buffer> {
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`Failed to download image: ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("OpenAI returned neither url nor b64_json");
}

export async function generateImages({
  prompt,
  count,
  referenceImage,
}: GenerateImagesParams): Promise<Buffer[]> {
  const results: Buffer[] = [];

  for (let i = 0; i < count; i++) {
    if (referenceImage) {
      const imageFile = await toFile(referenceImage, "reference.png", {
        type: "image/png",
      });
      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: [imageFile],
        prompt,
        n: 1,
        size: "1024x1536",
      });
      const data = response.data;
      if (!data || data.length === 0) {
        throw new Error("No image data returned from OpenAI");
      }
      results.push(await imageDataToBuffer(data[0]));
    } else {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1536",
        quality: "medium",
      });
      const data = response.data;
      if (!data || data.length === 0) {
        throw new Error("No image data returned from OpenAI");
      }
      results.push(await imageDataToBuffer(data[0]));
    }
  }

  return results;
}

export interface InpaintParams {
  imageBuffer: Buffer;
  maskBuffer: Buffer;
  prompt: string;
}

export async function inpaintImage({
  imageBuffer,
  maskBuffer,
  prompt,
}: InpaintParams): Promise<Buffer> {
  const imageFile = await toFile(imageBuffer, "image.png", {
    type: "image/png",
  });
  const maskFile = await toFile(maskBuffer, "mask.png", {
    type: "image/png",
  });

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: imageFile,
    mask: maskFile,
    prompt,
    n: 1,
    size: "1024x1536",
  });

  const data = response.data;
  if (!data || data.length === 0) {
    throw new Error("No image data returned from inpainting");
  }

  return imageDataToBuffer(data[0]);
}
