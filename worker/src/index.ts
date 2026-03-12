import "dotenv/config";
import express from "express";
import { Worker } from "bullmq";
import { processGeneration } from "./processors/generation.processor.js";
import { processInpaint } from "./processors/inpaint.processor.js";
import type { GenerationJobData } from "./queues/generation.queue.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const redisUrl = new URL(REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379"),
};

const worker = new Worker<GenerationJobData>(
  "cover-generation",
  async (job) => {
    console.log(`[worker] Processing job ${job.id} (${job.name}): generation ${job.data.generationId}`);
    if (job.name === "inpaint") {
      await processInpaint(job as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    } else {
      await processGeneration(job);
    }
    console.log(`[worker] Completed job ${job.id}`);
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err);
});

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", queue: "cover-generation" });
});

app.listen(PORT, () => {
  console.log(`[worker] Express health server listening on port ${PORT}`);
  console.log(`[worker] BullMQ worker connected to ${REDIS_URL}`);
});
