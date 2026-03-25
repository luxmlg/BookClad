import { Queue } from "bullmq";
import Redis from "ioredis";
import { QUEUE_NAME } from "@/lib/constants";

function parseRedisConnection() {
  const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || "6379"),
    password: redisUrl.password || undefined,
    username: redisUrl.username || undefined,
  };
}

let _queue: Queue | null = null;

export function getGenerationQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, { connection: parseRedisConnection() });
  }
  return _queue;
}

let _publisher: Redis | null = null;

export function getRedisPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(parseRedisConnection());
  }
  return _publisher;
}
