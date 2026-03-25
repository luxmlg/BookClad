import type { Job } from "bullmq";
import { redisPublisher } from "./redis.js";
import type { GenerationStatus } from "./constants.js";
import { EVENT_TYPE } from "./constants.js";

export type GenerationEvent =
  | { type: typeof EVENT_TYPE.STATUS; status: GenerationStatus }
  | { type: typeof EVENT_TYPE.PROGRESS; message: string; step: number; totalSteps: number }
  | { type: typeof EVENT_TYPE.COMPLETED }
  | { type: typeof EVENT_TYPE.FAILED; error?: string }
  | { type: typeof EVENT_TYPE.RETRYING; retryCount: number; retryReason: string; nextRetryAt: string; errorMessage: string };

export async function publishProgress(
  job: Job,
  generationId: string,
  event: GenerationEvent
) {
  const logMessage =
    event.type === EVENT_TYPE.PROGRESS ? event.message : event.type.toUpperCase();
  job.log(logMessage);
  await redisPublisher.publish(
    `generation:${generationId}`,
    JSON.stringify(event)
  );
}
