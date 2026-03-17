import { prisma } from "./prisma.js";
import { redisPublisher } from "./redis.js";
import { EVENT_TYPE, GENERATION_STATUS } from "./constants.js";

export async function refundCredits(
  userId: string,
  generationId: string,
  creditCost: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: creditCost } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: creditCost,
        balanceAfter: user.creditBalance,
        type: "REFUND",
        description: "Generation failed — credits refunded",
        generationId,
      },
    });
  });
}

/**
 * Idempotently mark a stale generation as FAILED, refund credits, and publish
 * a failure event so connected clients update. Safe to call multiple times —
 * skips generations that are already COMPLETED or FAILED.
 */
export async function refundStaleGeneration(generationId: string): Promise<boolean> {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      status: true,
      creditCost: true,
      project: { select: { userId: true } },
    },
  });

  if (!generation) return false;
  if (
    generation.status === GENERATION_STATUS.COMPLETED ||
    generation.status === GENERATION_STATUS.FAILED
  ) {
    return false;
  }

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: GENERATION_STATUS.FAILED },
  });

  if (generation.creditCost && generation.creditCost > 0) {
    await refundCredits(generation.project.userId, generationId, generation.creditCost);
  }

  // Notify connected clients so UI reflects the failure
  await redisPublisher.publish(
    `generation:${generationId}`,
    JSON.stringify({ type: EVENT_TYPE.FAILED, error: "Generation stalled and was cleaned up" }),
  );

  return true;
}
