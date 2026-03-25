import { Job, UnrecoverableError } from "bullmq";
import sharp from "sharp";
import { prisma } from "../lib/prisma.js";
import { publishProgress } from "../lib/progress.js";
import { generateSingleImage } from "../services/gemini.service.js";
import { upscaleImage } from "../services/upscale.service.js";
import { cropToKDP } from "../services/image.service.js";
import { uploadImage, downloadImage } from "../services/storage.service.js";
import type { GenerationJobData } from "../queues/generation.queue.js";
import { buildSystemPrompt, buildAttributeContext, buildAttributeValues, extractDescriptions, type TextLayerInfo } from "../lib/prompt.js";
import { KDP, GENERATION_STATUS, EVENT_TYPE, GEMINI_MODEL_IDS, GEMINI_MODEL_CONFIG, RETRY_DELAYS, MAX_OTHER_RETRIES, MAX_HIGH_DEMAND_RETRIES, CREDIT_COST_PER_IMAGE } from "../lib/constants.js";
import { refundCredits } from "../lib/credits.js";
import { preflight } from "../lib/health.js";

export async function processGeneration(job: Job<GenerationJobData>) {
  const { generationId, projectId, userId, imageCount, referenceImageKey, model } =
    job.data;

  // totalSteps: generate + per-image steps + optional reference download
  // Quick: upload only. Others: upscale + crop + upload
  const hasRef = !!referenceImageKey;
  const stepsPerImage = model === "quick" ? 2 : 4;
  const totalSteps = (hasRef ? 1 : 0) + imageCount * stepsPerImage;
  let step = 0;

  // Check if user cancelled while this retry was queued
  const genCheck = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { status: true },
  });
  if (genCheck?.status === GENERATION_STATUS.FAILED) {
    console.log(`[generation] Generation ${generationId} was cancelled, skipping`);
    return;
  }

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: GENERATION_STATUS.PROCESSING },
  });
  await publishProgress(job, generationId, { type: EVENT_TYPE.STATUS, status: GENERATION_STATUS.PROCESSING });

  try {
    await preflight();

    const [project, generation, attributeConfigRecord] = await Promise.all([
      prisma.coverProject.findUniqueOrThrow({
        where: { id: projectId },
      }),
      prisma.generation.findUniqueOrThrow({
        where: { id: generationId },
        select: { includeLayers: true, textLayerSnapshot: true, attributeSnapshot: true },
      }),
      prisma.attributeConfig.findUnique({
        where: { userId },
        select: { config: true },
      }),
    ]);

    const textLayers: TextLayerInfo[] = Array.isArray(generation.textLayerSnapshot)
      ? (generation.textLayerSnapshot as unknown as TextLayerInfo[])
      : [];

    const promptOptions = {
      includeLayers: generation.includeLayers,
      textLayers,
      isReference: !!referenceImageKey,
    };

    const snapshot = (generation.attributeSnapshot as Record<string, string | string[]> | null)
      ?? (project.attributes as Record<string, string | string[]>);

    const descriptions = attributeConfigRecord
      ? extractDescriptions(attributeConfigRecord.config)
      : undefined;

    const systemPrompt = buildSystemPrompt(promptOptions);
    const attributeContext = buildAttributeContext(snapshot, descriptions);
    const attributeValues = buildAttributeValues(snapshot, descriptions);
    const userPrompt = [attributeContext, attributeValues].filter(Boolean).join("\n\n");
    const fullPrompt = systemPrompt + "\n\n" + userPrompt;

    const geminiModelId = GEMINI_MODEL_IDS[model];
    if (!geminiModelId) throw new Error(`Unknown model: ${model}`);
    const geminiConfig = GEMINI_MODEL_CONFIG[model];
    const isQuick = model === "quick";

    let refBuffer: Buffer | undefined;
    if (referenceImageKey) {
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Downloading reference image...", step, totalSteps });
      refBuffer = job.data.flattenedImageDataUrl
        ? Buffer.from(job.data.flattenedImageDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64")
        : await downloadImage(referenceImageKey);
    }

    if (!job.data.isExtension) {
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          prompt: systemPrompt,
          userPrompt,
          descriptionSnapshot: descriptions ? JSON.parse(JSON.stringify(descriptions)) : undefined,
          aiModelId: geminiModelId,
        },
      });
    }

    for (let i = 0; i < imageCount; i++) {
      // Generate
      step++;
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.PROGRESS,
        message: `Generating image ${i + 1}/${imageCount}...`,
        step,
        totalSteps,
      });
      const rawImage = await generateSingleImage({
        prompt: fullPrompt,
        referenceImage: refBuffer,
        modelId: geminiModelId,
        config: geminiConfig,
      });

      // Process
      let finalImage: Buffer;
      let imageWidth: number;
      let imageHeight: number;

      if (isQuick) {
        finalImage = rawImage;
        const metadata = await sharp(finalImage).metadata();
        imageWidth = metadata.width ?? 0;
        imageHeight = metadata.height ?? 0;
      } else {
        step++;
        await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Upscaling image ${i + 1}/${imageCount}...`, step, totalSteps });
        const upscaled = await upscaleImage(rawImage);

        step++;
        await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Cropping image ${i + 1} to KDP dimensions...`, step, totalSteps });
        finalImage = await cropToKDP(upscaled);
        imageWidth = KDP.width;
        imageHeight = KDP.height;
      }

      // Upload + save
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Uploading image ${i + 1}/${imageCount}...`, step, totalSteps });
      const storageKey = await uploadImage(finalImage, `projects/${projectId}`);

      await prisma.generatedImage.create({
        data: {
          generationId,
          storageKey,
          width: imageWidth,
          height: imageHeight,
          selected: false,
        },
      });
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: GENERATION_STATUS.COMPLETED, errorMessage: null },
    });

    await publishProgress(job, generationId, { type: EVENT_TYPE.COMPLETED });
  } catch (error) {
    const generationId = job.data.generationId;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    // Guard: if already FAILED (user cancelled + refunded), skip all error handling
    const genStatus = await prisma.generation.findUnique({
      where: { id: generationId },
      select: { status: true },
    });
    if (genStatus?.status === GENERATION_STATUS.FAILED) {
      throw new UnrecoverableError("Cancelled by user");
    }

    // Path 1: Extensions don't auto-retry
    if (job.data.isExtension) {
      const [actualCount, gen] = await Promise.all([
        prisma.generatedImage.count({ where: { generationId } }),
        prisma.generation.findUnique({
          where: { id: generationId },
          select: { imageCount: true },
        }),
      ]);

      const preExtensionCount = (gen?.imageCount ?? 0) - (job.data.imageCount ?? 0);
      const newImagesCreated = Math.max(0, actualCount - preExtensionCount);
      const perImageCost = CREDIT_COST_PER_IMAGE[job.data.model];
      if (perImageCost === undefined) throw new Error(`Unknown model "${job.data.model}"`);
      const costForNewImages = newImagesCreated * perImageCost;
      const refundAmount = Math.max(0, job.data.creditCost - costForNewImages);

      if (newImagesCreated > 0) {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: GENERATION_STATUS.COMPLETED,
            imageCount: actualCount,
            creditCost: { decrement: refundAmount },
            errorMessage: refundAmount > 0
              ? `${actualCount} of ${gen?.imageCount ?? actualCount} images generated. ${refundAmount} credits refunded.`
              : null,
          },
        });
      } else {
        // No new images — revert to pre-extension state
        const revertMsg = preExtensionCount < (gen?.imageCount ?? 0)
          ? `${preExtensionCount} of ${gen?.imageCount ?? preExtensionCount} images generated. ${job.data.creditCost} credits refunded.`
          : null;
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: GENERATION_STATUS.COMPLETED,
            imageCount: preExtensionCount,
            creditCost: { decrement: job.data.creditCost },
            errorMessage: revertMsg,
          },
        });
      }
      if (refundAmount > 0) {
        await refundCredits(job.data.userId, generationId, refundAmount);
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
      const perImageCost = CREDIT_COST_PER_IMAGE[job.data.model];
      if (perImageCost === undefined) throw new Error(`Unknown model "${job.data.model}"`);
      const costForCreated = perImageCost * existingImages;
      const partialRefund = Math.max(0, job.data.creditCost - costForCreated);
      const requestedCount = job.data.imageCount ?? existingImages;
      const partialMsg = `${existingImages} of ${requestedCount} images generated. ${partialRefund} credits refunded.`;

      const updated = await prisma.generation.updateMany({
        where: { id: generationId, status: { not: GENERATION_STATUS.FAILED } },
        data: {
          status: GENERATION_STATUS.COMPLETED,
          errorMessage: partialMsg,
          creditCost: costForCreated,
          // imageCount intentionally NOT updated — preserve original requested count
          // so frontend can calculate failed slots: imageCount - images.length
        },
      });
      if (updated.count > 0 && partialRefund > 0) {
        await refundCredits(job.data.userId, generationId, partialRefund);
      }
      await publishProgress(job, generationId, {
        type: EVENT_TYPE.COMPLETED,
        errorMessage: partialMsg,
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

      const retryUpdated = await prisma.generation.updateMany({
        where: { id: generationId, status: { not: GENERATION_STATUS.FAILED } },
        data: {
          status: GENERATION_STATUS.RETRYING,
          retryCount: attemptNumber,
          retryReason,
          nextRetryAt,
          errorMessage: errorMsg,
        },
      });
      if (retryUpdated.count === 0) {
        throw new UnrecoverableError("Cancelled by user");
      }
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
    const failUpdated = await prisma.generation.updateMany({
      where: { id: generationId, status: { not: GENERATION_STATUS.FAILED } },
      data: { status: GENERATION_STATUS.FAILED, errorMessage: errorMsg },
    });
    if (failUpdated.count > 0 && job.data.creditCost > 0) {
      await refundCredits(job.data.userId, generationId, job.data.creditCost);
    }
    await publishProgress(job, generationId, {
      type: EVENT_TYPE.FAILED,
      error: errorMsg,
    });
    throw new UnrecoverableError(errorMsg);
  }
}
