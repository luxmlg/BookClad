import { Queue } from "bullmq";
import { QUEUE_NAME } from "../lib/constants.js";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379"),
};

export const generationQueue = new Queue(QUEUE_NAME, { connection });

export interface GenerationJobData {
  generationId: string;
  projectId: string;
  userId: string;
  imageCount: number;
  model: string;
  referenceImageKey: string | null;
  flattenedImageDataUrl?: string | null;
  creditCost: number;
  isExtension?: boolean;
}
