import { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { publishProgress } from "../lib/progress.js";
import { inpaintImage as openaiInpaint } from "../services/openai.service.js";
import { ideogramInpaint } from "../services/ideogram.service.js";
import { inpaintImage as geminiInpaint } from "../services/gemini.service.js";
import { upscaleImage } from "../services/upscale.service.js";
import { cropToKDP } from "../services/image.service.js";
import { uploadImage, downloadImage } from "../services/storage.service.js";
import { KDP } from "../lib/constants.js";

export interface InpaintJobData {
  generationId: string;
  projectId: string;
  userId: string;
  sourceImageKey: string;
  maskBase64: string;
  prompt: string;
  model: string;
  flattenedImageDataUrl?: string | null;
}

async function dispatchInpaint(
  model: string,
  imageBuffer: Buffer,
  maskBuffer: Buffer,
  prompt: string
): Promise<Buffer> {
  switch (model) {
    case "gemini":
      return geminiInpaint({ imageBuffer, prompt });
    case "ideogram":
      return ideogramInpaint({ imageBuffer, maskBuffer, prompt });
    case "openai":
    default:
      return openaiInpaint({ imageBuffer, maskBuffer, prompt });
  }
}

export async function processInpaint(job: Job<InpaintJobData>) {
  const { generationId, projectId, sourceImageKey, maskBase64, prompt, model } =
    job.data;

  const totalSteps = 5; // download, inpaint, upscale, crop, upload

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: "PROCESSING" },
  });
  await publishProgress(job, generationId, { type: "status", status: "PROCESSING" });

  try {
    await publishProgress(job, generationId, { type: "progress", message: "Downloading source image...", step: 1, totalSteps });
    const imageBuffer = job.data.flattenedImageDataUrl
      ? Buffer.from(job.data.flattenedImageDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64")
      : await downloadImage(sourceImageKey);

    const maskBuffer = Buffer.from(
      maskBase64.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    await publishProgress(job, generationId, { type: "progress", message: `Inpainting with ${model}...`, step: 2, totalSteps });
    const result = await dispatchInpaint(model, imageBuffer, maskBuffer, prompt);

    await publishProgress(job, generationId, { type: "progress", message: "Upscaling inpainted image...", step: 3, totalSteps });
    const upscaled = await upscaleImage(result);

    await publishProgress(job, generationId, { type: "progress", message: "Cropping to KDP dimensions...", step: 4, totalSteps });
    const final = await cropToKDP(upscaled);

    await publishProgress(job, generationId, { type: "progress", message: "Uploading result...", step: 5, totalSteps });
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

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "COMPLETED" },
    });

    await publishProgress(job, generationId, { type: "completed" });
  } catch (error) {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "FAILED" },
    });
    await publishProgress(job, generationId, {
      type: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
