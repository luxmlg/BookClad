import sharp from "sharp";
import { KDP } from "../lib/constants.js";

/**
 * Pad an image to a target aspect ratio using mirrored edges.
 * Used for bake mode: pad 5:8 → 9:16 so Gemini generates within
 * the padded frame, then cropToKDP removes only the padding.
 */
export async function padToAspectRatio(
  imageBuffer: Buffer,
  targetAspectRatio: string,
): Promise<Buffer> {
  const [aw, ah] = targetAspectRatio.split(":").map(Number);
  if (!aw || !ah) return imageBuffer;
  const targetAspect = aw / ah;

  const metadata = await sharp(imageBuffer).metadata();
  const srcWidth = metadata.width ?? KDP.width;
  const srcHeight = metadata.height ?? KDP.height;
  const srcAspect = srcWidth / srcHeight;

  // Already matches or is narrower than target — no padding needed
  if (srcAspect <= targetAspect + 0.001) return imageBuffer;

  // Source is wider than target — need to pad height (top/bottom)
  const newHeight = Math.round(srcWidth / targetAspect);
  const extraHeight = newHeight - srcHeight;
  if (extraHeight <= 0) return imageBuffer;

  const padTop = Math.floor(extraHeight / 2);
  const padBottom = extraHeight - padTop;

  return sharp(imageBuffer)
    .extend({ top: padTop, bottom: padBottom, extendWith: "mirror" })
    .toBuffer();
}

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
