import { prisma } from "@/lib/prisma";
import { AI_FILL_CREDIT_COST, CREDIT_COST_PER_IMAGE } from "@/lib/constants";
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

/**
 * Atomically check balance, deduct credits, and update an existing generation for extension.
 * Uses updateMany with status=COMPLETED to prevent concurrent extensions.
 * Throws InsufficientCreditsError if balance is too low.
 */
export async function reserveExtensionCredits(
  userId: string,
  generationId: string,
  creditCost: number,
  additionalImageCount: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.creditBalance < creditCost) {
      throw new InsufficientCreditsError(creditCost, user.creditBalance);
    }

    const newBalance = user.creditBalance - creditCost;

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: newBalance },
    });

    const updated = await tx.generation.updateMany({
      where: { id: generationId, status: "COMPLETED" },
      data: {
        imageCount: { increment: additionalImageCount },
        creditCost: { increment: creditCost },
        status: "QUEUED",
      },
    });

    if (updated.count === 0) {
      throw new Error("Generation is not available for extension");
    }

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -creditCost,
        balanceAfter: newBalance,
        type: "RESERVE",
        description: `Extend generation: +${additionalImageCount} images`,
        generationId,
      },
    });
  });
}

/**
 * Atomically check balance, deduct one AI fill credit, and create a transaction record.
 * Throws InsufficientCreditsError if balance is too low.
 */
export async function reserveAiFillCredits(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (user.creditBalance < AI_FILL_CREDIT_COST) {
      throw new InsufficientCreditsError(AI_FILL_CREDIT_COST, user.creditBalance);
    }

    const newBalance = user.creditBalance - AI_FILL_CREDIT_COST;

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: newBalance },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "RESERVE",
        amount: -AI_FILL_CREDIT_COST,
        balanceAfter: newBalance,
        description: "AI attribute generation",
      },
    });
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

