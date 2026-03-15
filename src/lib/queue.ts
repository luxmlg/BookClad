import { Queue } from "bullmq";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

export const generationQueue = new Queue("cover-generation", {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || "6379"),
  },
});
