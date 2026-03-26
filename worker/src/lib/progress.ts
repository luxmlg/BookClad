import type { Job } from "bullmq";
import { redisPublisher } from "./redis.js";
import type { GenerationStatus } from "./constants.js";
import { EVENT_TYPE } from "./constants.js";

export type GenerationEvent =
  | { type: typeof EVENT_TYPE.STATUS; status: GenerationStatus }
  | { type: typeof EVENT_TYPE.PROGRESS; message: string; step: number; totalSteps: number }
  | { type: typeof EVENT_TYPE.COMPLETED; errorMessage?: string }
  | { type: typeof EVENT_TYPE.FAILED; error?: string }
  | { type: typeof EVENT_TYPE.RETRYING; retryCount: number; retryReason: string; nextRetryAt: string; errorMessage: string };

/** Events that represent a status transition (not granular progress). */
const STATUS_EVENTS = new Set<string>([
  EVENT_TYPE.STATUS,
  EVENT_TYPE.COMPLETED,
  EVENT_TYPE.FAILED,
  EVENT_TYPE.RETRYING,
]);

export async function publishProgress(
  job: Job,
  generationId: string,
  projectId: string,
  event: GenerationEvent,
) {
  const logMessage =
    event.type === EVENT_TYPE.PROGRESS ? event.message : event.type.toUpperCase();
  job.log(logMessage);
  await redisPublisher.publish(
    `generation:${generationId}`,
    JSON.stringify(event),
  );

  // Dual-publish status transitions to project channel for dashboard subscribers
  if (STATUS_EVENTS.has(event.type)) {
    await redisPublisher.publish(
      `project:${projectId}`,
      JSON.stringify({ generationId, ...event }),
    );
  }
}
