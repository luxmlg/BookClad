import { Queue } from "bullmq";
import { QUEUE_NAME } from "@/lib/constants";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

export const generationQueue = new Queue(QUEUE_NAME, {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || "6379"),
    password: redisUrl.password || undefined,
    username: redisUrl.username || undefined,
  },
});
