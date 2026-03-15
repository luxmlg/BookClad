import sharp from "sharp";

const useReplicate = !!process.env.REPLICATE_API_TOKEN;

const REPLICATE_ESRGAN_MODEL = "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa" as const;
const UPSCALE_FACTOR = 2;

async function upscaleWithReplicate(imageBuffer: Buffer): Promise<Buffer> {
  const { default: Replicate } = await import("replicate");
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const base64 = `data:image/png;base64,${imageBuffer.toString("base64")}`;

  const output = await replicate.run(
    REPLICATE_ESRGAN_MODEL,
    {
      input: {
        image: base64,
        scale: UPSCALE_FACTOR,
        face_enhance: false,
      },
    }
  );

  const outputUrl = typeof output === "string" ? output : String(output);
  const res = await fetch(outputUrl);
  if (!res.ok)
    throw new Error(`Failed to download upscaled image: ${res.statusText}`);

  return Buffer.from(await res.arrayBuffer());
}

async function upscaleWithSharp(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = (metadata.width ?? 1024) * UPSCALE_FACTOR;
  const height = (metadata.height ?? 1536) * UPSCALE_FACTOR;

  return sharp(imageBuffer)
    .resize(width, height, { kernel: sharp.kernel.lanczos3 })
    .toBuffer();
}

export async function upscaleImage(imageBuffer: Buffer): Promise<Buffer> {
  if (useReplicate) {
    console.log("[upscale] Using Replicate Real-ESRGAN");
    return upscaleWithReplicate(imageBuffer);
  }

  console.log("[upscale] Using Sharp lanczos3 resize (no REPLICATE_API_TOKEN)");
  return upscaleWithSharp(imageBuffer);
}
