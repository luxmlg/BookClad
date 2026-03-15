import sharp from "sharp";
import { KDP } from "../lib/constants.js";

export async function cropToKDP(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const srcWidth = metadata.width ?? 2048;
  const srcHeight = metadata.height ?? 3072;

  const targetAspect = KDP.width / KDP.height;
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
    .resize(KDP.width, KDP.height, { fit: "fill" })
    .withMetadata({ density: KDP.dpi })
    .jpeg({ quality: KDP.jpegQuality })
    .toBuffer();
}
