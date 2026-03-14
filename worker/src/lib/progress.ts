import type { Job } from "bullmq";
import { redisPublisher } from "./redis.js";

export type GenerationEvent =
  | { type: "status"; status: "QUEUED" | "PROCESSING" }
  | { type: "progress"; message: string; step: number; totalSteps: number }
  | { type: "completed" }
  | { type: "failed"; error?: string };

export async function publishProgress(
  job: Job,
  generationId: string,
  event: GenerationEvent
) {
  const logMessage =
    event.type === "progress" ? event.message : event.type.toUpperCase();
  job.log(logMessage);
  await redisPublisher.publish(
    `generation:${generationId}`,
    JSON.stringify(event)
  );
}
