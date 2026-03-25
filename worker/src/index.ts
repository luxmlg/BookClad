import "dotenv/config";
import { createServer } from "http";
import express from "express";
import { Job, Worker, UnrecoverableError } from "bullmq";
import { processGeneration } from "./processors/generation.processor.js";
import { processInpaint } from "./processors/inpaint.processor.js";
import type { GenerationJobData } from "./queues/generation.queue.js";
import { setupWebSocket } from "./lib/websocket.js";
import { QUEUE_NAME, JOB_TYPE, GENERATION_STATUS, RETRY_DELAYS, EVENT_TYPE } from "./lib/constants.js";
import { refundStaleGeneration, refundCredits } from "./lib/credits.js";
import { startCreditExpirySweep } from "./lib/credit-expiry.js";
import { prisma } from "./lib/prisma.js";
import { redisPublisher } from "./lib/redis.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const redisUrl = new URL(REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379"),
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
};

const worker = new Worker<GenerationJobData>(
  QUEUE_NAME,
  async (job) => {
    console.log(`[worker] Processing job ${job.id} (${job.name}): generation ${job.data.generationId} (attempt ${job.attemptsMade + 1})`);
    if (job.name === JOB_TYPE.INPAINT) {
      await processInpaint(job as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    } else {
      await processGeneration(job);
    }
    console.log(`[worker] Completed job ${job.id}`);
  },
  {
    connection,
    concurrency: 2,
    stalledInterval: 30_000,
    maxStalledCount: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        const idx = Math.min(attemptsMade - 1, RETRY_DELAYS.length - 1);
        return RETRY_DELAYS[idx];
      },
    },
  }
);

worker.on("failed", (job, err) => {
  if (!job) return;
  const willRetry = !(err instanceof UnrecoverableError) && job.attemptsMade < (job.opts.attempts ?? 1);
  if (willRetry) {
    console.log(`[worker] Job ${job.id} attempt ${job.attemptsMade} failed, will retry: ${err.message}`);
  } else {
    console.error(`[worker] Job ${job.id} failed permanently:`, err.message);
    if (process.env.NODE_ENV !== "production") {
      console.error(err.stack);
    }
  }
});

worker.on("stalled", async (jobId) => {
  console.log(`[worker] Job ${jobId} stalled — checking generation status`);
  const job = await Job.fromId<GenerationJobData>(worker, jobId);
  if (job?.data?.generationId) {
    const refunded = await refundStaleGeneration(job.data.generationId);
    if (refunded) {
      console.log(`[worker] Refunded stale generation ${job.data.generationId}`);
    }
  }
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err);
});

const app = express();

// CORS for WebSocket upgrade requests
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", APP_URL);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", queue: QUEUE_NAME });
});

const STALE_THRESHOLD_MINUTES = 30;
const RETRYING_STALE_THRESHOLD_MINUTES = 120;

async function sweepStaleGenerations(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);
  const retryingCutoff = new Date(Date.now() - RETRYING_STALE_THRESHOLD_MINUTES * 60 * 1000);

  const staleGenerations = await prisma.generation.findMany({
    where: {
      OR: [
        {
          status: { in: [GENERATION_STATUS.QUEUED, GENERATION_STATUS.PROCESSING] },
          createdAt: { lt: cutoff },
        },
        {
          status: GENERATION_STATUS.RETRYING,
          createdAt: { lt: retryingCutoff },
        },
      ],
    },
    select: { id: true },
  });

  if (staleGenerations.length === 0) return;

  console.log(`[worker] Found ${staleGenerations.length} stale generation(s), refunding...`);

  for (const gen of staleGenerations) {
    const generation = await prisma.generation.findUnique({
      where: { id: gen.id },
      select: { status: true, creditCost: true, project: { select: { userId: true } } },
    });
    if (!generation) continue;

    if (generation.status === GENERATION_STATUS.RETRYING) {
      await prisma.generation.update({
        where: { id: gen.id },
        data: { status: GENERATION_STATUS.FAILED, nextRetryAt: null, errorMessage: "Generation timed out after extended retrying" },
      });
      if (generation.creditCost && generation.creditCost > 0) {
        await refundCredits(generation.project.userId, gen.id, generation.creditCost);
      }
      await redisPublisher.publish(
        `generation:${gen.id}`,
        JSON.stringify({ type: EVENT_TYPE.FAILED, error: "Generation timed out" }),
      );
      console.log(`[worker] Swept stale retrying generation ${gen.id}`);
    } else {
      const refunded = await refundStaleGeneration(gen.id);
      if (refunded) {
        console.log(`[worker] Swept stale generation ${gen.id}`);
      }
    }
  }
}

const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`[worker] Express health server listening on port ${PORT}`);
  console.log(`[worker] BullMQ worker connected to ${REDIS_URL}`);
  sweepStaleGenerations().catch(console.error);
  startCreditExpirySweep();
});
