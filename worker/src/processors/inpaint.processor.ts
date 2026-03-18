import { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { publishProgress } from "../lib/progress.js";
import { inpaintImage as geminiInpaint } from "../services/gemini.service.js";
import { upscaleImage } from "../services/upscale.service.js";
import { cropToKDP } from "../services/image.service.js";
import { uploadImage, downloadImage } from "../services/storage.service.js";
import { KDP, GENERATION_STATUS, EVENT_TYPE, GEMINI_MODEL_IDS } from "../lib/constants.js";
import { refundCredits } from "../lib/credits.js";

export interface InpaintJobData {
  generationId: string;
  projectId: string;
  userId: string;
  sourceImageKey: string;
  maskBase64: string;
  prompt: string;
  model: string;
  flattenedImageDataUrl?: string | null;
  creditCost: number;
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
  const { generationId, projectId, sourceImageKey, maskBase64, prompt, model } =
    job.data;

  const totalSteps = 5; // download, inpaint, upscale, crop, upload

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: GENERATION_STATUS.PROCESSING },
  });
  await publishProgress(job, generationId, { type: EVENT_TYPE.STATUS, status: GENERATION_STATUS.PROCESSING });

  try {
    await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Downloading source image...", step: 1, totalSteps });
    const imageBuffer = job.data.flattenedImageDataUrl
      ? Buffer.from(job.data.flattenedImageDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64")
      : await downloadImage(sourceImageKey);

    const maskBuffer = Buffer.from(
      maskBase64.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Inpainting...", step: 2, totalSteps });
    const result = await dispatchInpaint(model, imageBuffer, maskBuffer, prompt);

    const geminiModelId = GEMINI_MODEL_IDS[model];
    await prisma.generation.update({
      where: { id: generationId },
      data: { aiModelId: geminiModelId },
    });

    await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Upscaling inpainted image...", step: 3, totalSteps });
    const upscaled = await upscaleImage(result);

    await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Cropping to KDP dimensions...", step: 4, totalSteps });
    const final = await cropToKDP(upscaled);

    await publishProgress(job, generationId, { type: EVENT_TYPE.PROGRESS, message: "Uploading result...", step: 5, totalSteps });
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
      data: { status: GENERATION_STATUS.COMPLETED },
    });

    await publishProgress(job, generationId, { type: EVENT_TYPE.COMPLETED });
  } catch (error) {
    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: GENERATION_STATUS.FAILED,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
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
