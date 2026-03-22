import { checkStorageHealth } from "../services/storage.service.js";
import { prisma } from "./prisma.js";

export async function preflight(): Promise<void> {
  const results = await Promise.allSettled([
    checkStorageHealth(),
    prisma.$queryRawUnsafe("SELECT 1"),
  ]);

  const errors: string[] = [];
  if (results[0].status === "rejected") {
    errors.push(`Storage: ${(results[0].reason as Error).message}`);
  }
  if (results[1].status === "rejected") {
    errors.push(`Database: ${(results[1].reason as Error).message}`);
  }

  if (errors.length > 0) {
    throw new Error(`Preflight failed — ${errors.join("; ")}`);
  }
}
