import { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { generateImages as openaiGenerate } from "../services/openai.service.js";
import { generateImages as geminiGenerate } from "../services/gemini.service.js";
import { ideogramGenerate } from "../services/ideogram.service.js";
import { upscaleImage } from "../services/upscale.service.js";
import { cropToKDP } from "../services/image.service.js";
import { uploadImage, downloadImage } from "../services/storage.service.js";
import type { GenerationJobData } from "../queues/generation.queue.js";
import { buildPrompt, buildReferencePrompt } from "../lib/prompt.js";

const KDP_WIDTH = 1600;
const KDP_HEIGHT = 2560;

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

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: "PROCESSING" },
  });

  try {
    const project = await prisma.coverProject.findUniqueOrThrow({
      where: { id: projectId },
    });

    let prompt: string;
    let rawImages: Buffer[];

    if (referenceImageKey) {
      prompt = buildReferencePrompt(project);
      job.log(`Downloading reference image...`);
      const refBuffer = await downloadImage(referenceImageKey);
      job.log(`Generating ${imageCount} images from reference with ${model}...`);
      rawImages = await dispatchGenerate(model, prompt, imageCount, refBuffer);
    } else {
      prompt = buildPrompt(project);
      job.log(`Generating ${imageCount} images with ${model}...`);
      rawImages = await dispatchGenerate(model, prompt, imageCount);
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: { prompt },
    });

    for (let i = 0; i < rawImages.length; i++) {
      job.log(`Upscaling image ${i + 1}/${rawImages.length}...`);
      const upscaled = await upscaleImage(rawImages[i]);

      job.log(`Cropping image ${i + 1} to KDP dimensions...`);
      const final = await cropToKDP(upscaled);

      job.log(`Uploading image ${i + 1}...`);
      const storageKey = await uploadImage(final, `projects/${projectId}`);

      await prisma.generatedImage.create({
        data: {
          generationId,
          storageKey,
          width: KDP_WIDTH,
          height: KDP_HEIGHT,
          selected: false,
        },
      });
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "COMPLETED" },
    });

    await prisma.user.update({
      where: { id: job.data.userId },
      data: { generationsUsed: { increment: 1 } },
    });

    job.log("Generation complete.");
  } catch (error) {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}
