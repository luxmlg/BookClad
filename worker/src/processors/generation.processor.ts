import { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { publishProgress } from "../lib/progress.js";
import { generateImages as openaiGenerate } from "../services/openai.service.js";
import { generateImages as geminiGenerate } from "../services/gemini.service.js";
import { ideogramGenerate } from "../services/ideogram.service.js";
import { upscaleImage } from "../services/upscale.service.js";
import { cropToKDP } from "../services/image.service.js";
import { uploadImage, downloadImage } from "../services/storage.service.js";
import type { GenerationJobData } from "../queues/generation.queue.js";
import { buildSystemPrompt, buildAttributeContext, buildAttributeValues, extractDescriptions, type TextLayerInfo } from "../lib/prompt.js";
import { KDP, GENERATION_STATUS, EVENT_TYPE } from "../lib/constants.js";
import { refundCredits } from "../lib/credits.js";

async function dispatchGenerate(
  model: string,
  prompt: string,
  count: number,
  referenceImage?: Buffer
): Promise<Buffer[]> {
  switch (model) {
    case "gemini":
      return geminiGenerate({ prompt, count, referenceImage });
    case "ideogram":
      return ideogramGenerate({ prompt, count });
    case "openai":
    default:
      return openaiGenerate({ prompt, count, referenceImage });
  }
}

export async function processGeneration(job: Job<GenerationJobData>) {
  const { generationId, projectId, userId, imageCount, referenceImageKey, model } =
    job.data;

  // totalSteps: generate + (upscale + crop + upload) per image + optional reference download
  const hasRef = !!referenceImageKey;
  const totalSteps = (hasRef ? 1 : 0) + 1 + imageCount * 3;
  let step = 0;

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: GENERATION_STATUS.PROCESSING },
  });
  await publishProgress(job, generationId, { type: EVENT_TYPE.STATUS, status: GENERATION_STATUS.PROCESSING });

  try {
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

    let rawImages: Buffer[];

    if (referenceImageKey) {
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Downloading reference image...", step, totalSteps });
      const refBuffer = job.data.flattenedImageDataUrl
        ? Buffer.from(job.data.flattenedImageDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64")
        : await downloadImage(referenceImageKey);
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Generating ${imageCount} images from reference with ${model}...`, step, totalSteps });
      rawImages = await dispatchGenerate(model, fullPrompt, imageCount, refBuffer);
    } else {
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Generating ${imageCount} images with ${model}...`, step, totalSteps });
      rawImages = await dispatchGenerate(model, fullPrompt, imageCount);
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: {
        prompt: systemPrompt,
        userPrompt,
        descriptionSnapshot: descriptions ? JSON.parse(JSON.stringify(descriptions)) : undefined,
      },
    });

    for (let i = 0; i < rawImages.length; i++) {
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Upscaling image ${i + 1}/${rawImages.length}...`, step, totalSteps });
      const upscaled = await upscaleImage(rawImages[i]);

      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Cropping image ${i + 1} to KDP dimensions...`, step, totalSteps });
      const final = await cropToKDP(upscaled);

      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Uploading image ${i + 1}...`, step, totalSteps });
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
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: GENERATION_STATUS.FAILED },
    });

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
