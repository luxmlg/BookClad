import { Job, UnrecoverableError } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { publishProgress } from "../lib/progress.js";
import { inpaintImage as geminiInpaint } from "../services/gemini.service.js";
import { upscaleImage } from "../services/upscale.service.js";
import { cropToKDP } from "../services/image.service.js";
import { uploadImage, downloadImage } from "../services/storage.service.js";
import { KDP, GENERATION_STATUS, EVENT_TYPE, GEMINI_MODEL_IDS, GEMINI_MODEL_CONFIG, RETRY_DELAYS, MAX_OTHER_RETRIES, MAX_HIGH_DEMAND_RETRIES } from "../lib/constants.js";
import { refundCredits } from "../lib/credits.js";
import { extractDescriptions } from "../lib/prompt.js";
import { preflight } from "../lib/health.js";

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
  const config = GEMINI_MODEL_CONFIG[model];
  return geminiInpaint({ imageBuffer, prompt, modelId: geminiModelId, config });
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

  // Check if user cancelled while this retry was queued
  const genCheck = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { status: true },
  });
  if (genCheck?.status === GENERATION_STATUS.FAILED) {
    console.log(`[inpaint] Generation ${generationId} was cancelled, skipping`);
    return;
  }

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: GENERATION_STATUS.PROCESSING },
  });
  await publishProgress(job, generationId, { type: EVENT_TYPE.STATUS, status: GENERATION_STATUS.PROCESSING });

  try {
    await preflight();

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
    const generationId = job.data.generationId;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    // Path 1: Extensions don't auto-retry
    if (job.data.isExtension) {
      const actualCount = await prisma.generatedImage.count({
        where: { generationId },
      });
      if (actualCount > 0) {
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
            errorMessage: errorMsg,
          },
        });
      }
      if (job.data.creditCost > 0) {
        await refundCredits(job.data.userId, generationId, job.data.creditCost);
      }
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.FAILED,
        error: errorMsg,
      });
      throw new UnrecoverableError(errorMsg);
    }

    // Path 2: Partial success (some images created before error)
    const existingImages = await prisma.generatedImage.count({
      where: { generationId },
    });
    if (existingImages > 0) {
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: GENERATION_STATUS.FAILED, errorMessage: errorMsg },
      });
      if (job.data.creditCost > 0) {
        await refundCredits(job.data.userId, generationId, job.data.creditCost);
      }
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.FAILED,
        error: errorMsg,
      });
      throw new UnrecoverableError(errorMsg);
    }

    // Path 3/4: Classify error and determine retryability
    const statusCode = error instanceof Error && "status" in error
      ? (error as Error & { status: number }).status
      : 0;
    const isHighDemand =
      statusCode === 429 || statusCode === 503 ||
      /rate.?limit/i.test(errorMsg) ||
      /too many requests/i.test(errorMsg) ||
      /overloaded/i.test(errorMsg) ||
      /high demand/i.test(errorMsg);
    const retryReason = isHighDemand ? "high_demand" : "error";
    const maxRetries = isHighDemand ? MAX_HIGH_DEMAND_RETRIES : MAX_OTHER_RETRIES;

    const attemptNumber = job.attemptsMade + 1;
    const retryable = attemptNumber < maxRetries;

    if (retryable) {
      const delayIdx = Math.min(job.attemptsMade, RETRY_DELAYS.length - 1);
      const delay = RETRY_DELAYS[delayIdx];
      const nextRetryAt = new Date(Date.now() + delay);

      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: GENERATION_STATUS.RETRYING,
          retryCount: attemptNumber,
          retryReason,
          nextRetryAt,
          errorMessage: errorMsg,
        },
      });
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.RETRYING,
        retryCount: attemptNumber,
        retryReason,
        nextRetryAt: nextRetryAt.toISOString(),
        errorMessage: errorMsg,
      });
      throw error; // Re-throw original — BullMQ schedules retry. Do NOT refund.
    }

    // Not retryable — permanent failure
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: GENERATION_STATUS.FAILED, errorMessage: errorMsg },
    });
    if (job.data.creditCost > 0) {
      await refundCredits(job.data.userId, generationId, job.data.creditCost);
    }
    await publishProgress(job, generationId, {
      type: EVENT_TYPE.FAILED,
      error: errorMsg,
    });
    throw new UnrecoverableError(errorMsg);
  }
}
