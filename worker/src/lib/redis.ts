import Redis from "ioredis";

export const redisPublisher = new Redis.default(
  process.env.REDIS_URL ?? "redis://localhost:6379"
);
