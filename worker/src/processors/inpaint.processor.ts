import { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { inpaintImage as openaiInpaint } from "../services/openai.service.js";
import { ideogramInpaint } from "../services/ideogram.service.js";
import { inpaintImage as geminiInpaint } from "../services/gemini.service.js";
import { upscaleImage } from "../services/upscale.service.js";
import { cropToKDP } from "../services/image.service.js";
import { uploadImage, downloadImage } from "../services/storage.service.js";

const KDP_WIDTH = 1600;
const KDP_HEIGHT = 2560;

export interface InpaintJobData {
  generationId: string;
  projectId: string;
  userId: string;
  sourceImageKey: string;
  maskBase64: string;
  prompt: string;
  model: string;
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

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: "PROCESSING" },
  });

  try {
    job.log("Downloading source image...");
    const imageBuffer = await downloadImage(sourceImageKey);

    const maskBuffer = Buffer.from(
      maskBase64.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    job.log(`Inpainting with ${model}...`);
    const result = await dispatchInpaint(model, imageBuffer, maskBuffer, prompt);

    job.log("Upscaling inpainted image...");
    const upscaled = await upscaleImage(result);

    job.log("Cropping to KDP dimensions...");
    const final = await cropToKDP(upscaled);

    job.log("Uploading result...");
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

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "COMPLETED" },
    });

    job.log("Inpainting complete.");
  } catch (error) {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}
