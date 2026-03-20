import { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { publishProgress } from "../lib/progress.js";
import { inpaintImage as geminiInpaint } from "../services/gemini.service.js";
import { upscaleImage } from "../services/upscale.service.js";
import { cropToKDP } from "../services/image.service.js";
import { uploadImage, downloadImage } from "../services/storage.service.js";
import { KDP, GENERATION_STATUS, EVENT_TYPE, GEMINI_MODEL_IDS } from "../lib/constants.js";
import { refundCredits } from "../lib/credits.js";
import { extractDescriptions } from "../lib/prompt.js";

export interface InpaintJobData {
  generationId: string;
  projectId: string;
  userId: string;
  sourceImageKey: string;
  maskBase64: string | null;
  maskKey?: string | null;
  prompt: string;
  model: string;
  flattenedImageDataUrl?: string | null;
  imageCount?: number;
  creditCost: number;
  isExtension?: boolean;
}

async function dispatchInpaint(
  model: string,
  imageBuffer: Buffer,
  maskBuffer: Buffer,
  prompt: string
): Promise<Buffer> {
  const geminiModelId = GEMINI_MODEL_IDS[model];
  if (!geminiModelId) throw new Error(`Unknown model: ${model}`);
  return geminiInpaint({ imageBuffer, prompt, modelId: geminiModelId });
}

export async function processInpaint(job: Job<InpaintJobData>) {
  const {
    generationId,
    projectId,
    sourceImageKey,
    maskBase64,
    maskKey,
    prompt,
    model,
    isExtension,
  } = job.data;
  const imageCount = job.data.imageCount ?? 1;

  const stepsPerImage = 4; // inpaint, upscale, crop, upload
  const totalSteps = 1 + imageCount * stepsPerImage; // download + per-image steps
  let step = 0;

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: GENERATION_STATUS.PROCESSING },
  });
  await publishProgress(job, generationId, { type: EVENT_TYPE.STATUS, status: GENERATION_STATUS.PROCESSING });

  try {
    step++;
    await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Downloading source image...", step, totalSteps });
    const imageBuffer = job.data.flattenedImageDataUrl
      ? Buffer.from(job.data.flattenedImageDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64")
      : await downloadImage(sourceImageKey);

    const maskBuffer = maskBase64
      ? Buffer.from(maskBase64.replace(/^data:image\/\w+;base64,/, ""), "base64")
      : await downloadImage(maskKey!);

    if (!isExtension) {
      const geminiModelId = GEMINI_MODEL_IDS[model];
      const attributeConfigRecord = await prisma.attributeConfig.findUnique({
        where: { userId: job.data.userId },
        select: { config: true },
      });
      const descriptions = attributeConfigRecord
        ? extractDescriptions(attributeConfigRecord.config)
        : undefined;

      await prisma.generation.update({
        where: { id: generationId },
        data: {
          aiModelId: geminiModelId,
          descriptionSnapshot: descriptions
            ? JSON.parse(JSON.stringify(descriptions))
            : undefined,
        },
      });
    }

    for (let i = 0; i < imageCount; i++) {
      step++;
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.PROGRESS,
        message: imageCount > 1 ? `Inpainting image ${i + 1}/${imageCount}...` : "Inpainting...",
        step,
        totalSteps,
      });
      const result = await dispatchInpaint(model, imageBuffer, maskBuffer, prompt);

      step++;
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.PROGRESS,
        message: imageCount > 1 ? `Upscaling image ${i + 1}/${imageCount}...` : "Upscaling inpainted image...",
        step,
        totalSteps,
      });
      const upscaled = await upscaleImage(result);

      step++;
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.PROGRESS,
        message: imageCount > 1 ? `Cropping image ${i + 1} to KDP dimensions...` : "Cropping to KDP dimensions...",
        step,
        totalSteps,
      });
      const final = await cropToKDP(upscaled);

      step++;
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.PROGRESS,
        message: imageCount > 1 ? `Uploading image ${i + 1}...` : "Uploading result...",
        step,
        totalSteps,
      });
      const storageKey = await uploadImage(final, `projects/${projectId}`);

      await prisma.generatedImage.create({
        data: {
          generationId,
          storageKey,
          width: KDP.width,
          height: KDP.height,
          selected: false,
        },
      });
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: GENERATION_STATUS.COMPLETED },
    });

    await publishProgress(job, generationId, { type: EVENT_TYPE.COMPLETED });
  } catch (error) {
    if (isExtension) {
      const actualCount = await prisma.generatedImage.count({
        where: { generationId },
      });
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: GENERATION_STATUS.COMPLETED,
          imageCount: actualCount,
          creditCost: { decrement: job.data.creditCost },
        },
      });
    } else {
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: GENERATION_STATUS.FAILED,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    if (job.data.creditCost > 0) {
      await refundCredits(job.data.userId, generationId, job.data.creditCost);
    }

    await publishProgress(job, generationId, {
      type: EVENT_TYPE.FAILED,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
