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
import { buildPrompt, buildReferencePrompt } from "../lib/prompt.js";
import { KDP, GENERATION_STATUS, EVENT_TYPE } from "../lib/constants.js";

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
  const { generationId, projectId, imageCount, referenceImageKey, model } =
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
    const project = await prisma.coverProject.findUniqueOrThrow({
      where: { id: projectId },
    });

    let prompt: string;
    let rawImages: Buffer[];

    if (referenceImageKey) {
      prompt = buildReferencePrompt(project as Parameters<typeof buildReferencePrompt>[0]);
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Downloading reference image...", step, totalSteps });
      const refBuffer = job.data.flattenedImageDataUrl
        ? Buffer.from(job.data.flattenedImageDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64")
        : await downloadImage(referenceImageKey);
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Generating ${imageCount} images from reference with ${model}...`, step, totalSteps });
      rawImages = await dispatchGenerate(model, prompt, imageCount, refBuffer);
    } else {
      prompt = buildPrompt(project as Parameters<typeof buildPrompt>[0]);
      step++;
      await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: `Generating ${imageCount} images with ${model}...`, step, totalSteps });
      rawImages = await dispatchGenerate(model, prompt, imageCount);
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: { prompt },
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

    await prisma.user.update({
      where: { id: job.data.userId },
      data: { generationsUsed: { increment: 1 } },
    });

    await publishProgress(job, generationId, { type: EVENT_TYPE.COMPLETED });
  } catch (error) {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: GENERATION_STATUS.FAILED },
    });
    await publishProgress(job, generationId, {
      type: EVENT_TYPE.FAILED,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
