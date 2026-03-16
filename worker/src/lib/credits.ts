import { prisma } from "./prisma.js";

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
