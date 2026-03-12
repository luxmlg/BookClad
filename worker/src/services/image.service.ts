import sharp from "sharp";

const KDP_WIDTH = 1600;
const KDP_HEIGHT = 2560;
const KDP_DPI = 300;

export async function cropToKDP(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const srcWidth = metadata.width ?? 2048;
  const srcHeight = metadata.height ?? 3072;

  const targetAspect = KDP_WIDTH / KDP_HEIGHT;
  const srcAspect = srcWidth / srcHeight;

  let cropWidth = srcWidth;
  let cropHeight = srcHeight;

  if (srcAspect > targetAspect) {
    cropWidth = Math.round(srcHeight * targetAspect);
  } else {
    cropHeight = Math.round(srcWidth / targetAspect);
  }

  return sharp(imageBuffer)
    .extract({
      left: Math.round((srcWidth - cropWidth) / 2),
      top: Math.round((srcHeight - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    })
    .resize(KDP_WIDTH, KDP_HEIGHT, { fit: "fill" })
    .withMetadata({ density: KDP_DPI })
    .jpeg({ quality: 92 })
    .toBuffer();
}
