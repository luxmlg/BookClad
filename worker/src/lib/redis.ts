import IORedis from "ioredis";

export const redisPublisher = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379"
);
