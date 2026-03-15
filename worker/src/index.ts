import "dotenv/config";
import { createServer } from "http";
import express from "express";
import { Worker } from "bullmq";
import { processGeneration } from "./processors/generation.processor.js";
import { processInpaint } from "./processors/inpaint.processor.js";
import type { GenerationJobData } from "./queues/generation.queue.js";
import { setupWebSocket } from "./lib/websocket.js";
import { QUEUE_NAME, JOB_TYPE } from "./lib/constants.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const redisUrl = new URL(REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379"),
};

const worker = new Worker<GenerationJobData>(
  QUEUE_NAME,
  async (job) => {
    console.log(`[worker] Processing job ${job.id} (${job.name}): generation ${job.data.generationId}`);
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
  }
);

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
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

const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`[worker] Express health server listening on port ${PORT}`);
  console.log(`[worker] BullMQ worker connected to ${REDIS_URL}`);
});
