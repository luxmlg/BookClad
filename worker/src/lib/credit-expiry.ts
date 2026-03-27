import { prisma } from "./prisma.js";

export async function sweepExpiredCredits(): Promise<number> {
  const expiredPools = await prisma.creditPool.findMany({
    where: {
      expiresAt: { lt: new Date() },
      remaining: { gt: 0 },
    },
    select: { id: true, userId: true, remaining: true },
  });

  let count = 0;

  for (const pool of expiredPools) {
    await prisma.$transaction(async (tx) => {
      // Re-read pool inside transaction to get fresh remaining
      const freshPool = await tx.creditPool.findUnique({
        where: { id: pool.id },
      });
      if (!freshPool || freshPool.remaining <= 0) return;

      // Lock user row to prevent concurrent spends during expiry
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${freshPool.userId} FOR UPDATE`;

      await tx.creditPool.update({
        where: { id: pool.id },
        data: { remaining: 0 },
      });

      const user = await tx.user.update({
        where: { id: freshPool.userId },
        data: { creditBalance: { decrement: freshPool.remaining } },
      });

      await tx.creditTransaction.create({
        data: {
          userId: freshPool.userId,
          amount: -freshPool.remaining,
          balanceAfter: user.creditBalance,
          type: "EXPIRE",
          description: "Credits expired",
        },
      });
    });
    count++;
  }

  if (count > 0) {
    console.log(`[credit-expiry] Expired ${count} credit pools`);
  }

  return count;
}

const ONE_HOUR = 60 * 60 * 1000;

export function startCreditExpirySweep(): void {
  // Run on startup
  sweepExpiredCredits().catch((err) =>
    console.error("[credit-expiry] Startup sweep failed:", err)
  );

  // Run hourly
  setInterval(() => {
    sweepExpiredCredits().catch((err) =>
      console.error("[credit-expiry] Periodic sweep failed:", err)
    );
  }, ONE_HOUR);
}
