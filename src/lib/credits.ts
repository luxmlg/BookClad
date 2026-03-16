import { prisma } from "@/lib/prisma";
import { CREDIT_COST_PER_IMAGE, TIER_CREDITS } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma/client";

export class InsufficientCreditsError extends Error {
  public readonly required: number;
  public readonly available: number;

  constructor(required: number, available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = "InsufficientCreditsError";
    this.required = required;
    this.available = available;
  }
}

export function calculateCreditCost(model: string, imageCount: number): number {
  const perImage = CREDIT_COST_PER_IMAGE[model] ?? CREDIT_COST_PER_IMAGE.openai;
  return perImage * imageCount;
}

type GenerationCreateData = Omit<Prisma.GenerationUncheckedCreateInput, "creditCost">;

/**
 * Atomically check balance, deduct credits, create transaction & generation.
 * Throws InsufficientCreditsError if balance is too low.
 */
export async function reserveCredits(
  userId: string,
  creditCost: number,
  generationData: GenerationCreateData,
): Promise<{ generationId: string }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.creditBalance < creditCost) {
      throw new InsufficientCreditsError(creditCost, user.creditBalance);
    }

    const newBalance = user.creditBalance - creditCost;

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: newBalance },
    });

    const generation = await tx.generation.create({
      data: {
        ...generationData,
        creditCost,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -creditCost,
        balanceAfter: newBalance,
        type: "RESERVE",
        description: `Generation: ${generationData.model} x${generationData.imageCount}`,
        generationId: generation.id,
      },
    });

    return { generationId: generation.id };
  });
}

export async function grantCredits(
  userId: string,
  amount: number,
  description: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: amount } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount,
        balanceAfter: user.creditBalance,
        type: "GRANT",
        description,
      },
    });
  });
}

