import { prisma } from "@/lib/prisma";
import { AI_FILL_CREDIT_COST, CREDIT_COST_PER_IMAGE } from "@/lib/constants";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";

type TransactionClient = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

interface PoolParams {
  source: string;
  expiresAt: Date | null;
  priority: number;
}

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
  const perImage = CREDIT_COST_PER_IMAGE[model] ?? CREDIT_COST_PER_IMAGE.quick;
  return perImage * imageCount;
}

/**
 * Acquire a row-level lock on the User to serialize concurrent spends,
 * then drain credit pools in priority order (SUBSCRIPTION first via
 * priority=0, then FIFO by createdAt for priority=1).
 */
async function spendCredits(
  tx: TransactionClient,
  userId: string,
  amount: number,
): Promise<void> {
  // Lock the user row to serialize concurrent spends for this user
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

  const pools = await tx.creditPool.findMany({
    where: {
      userId,
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  let remaining = amount;

  for (const pool of pools) {
    if (remaining <= 0) break;
    const take = Math.min(pool.remaining, remaining);
    await tx.creditPool.update({
      where: { id: pool.id },
      data: { remaining: { decrement: take } },
    });
    remaining -= take;
  }

  if (remaining > 0) {
    const available = amount - remaining;
    throw new InsufficientCreditsError(amount, available);
  }

  await tx.user.update({
    where: { id: userId },
    data: { creditBalance: { decrement: amount } },
  });
}

type GenerationCreateData = Omit<
  Prisma.GenerationUncheckedCreateInput,
  "creditCost"
>;

/**
 * Atomically spend credits from pools, create transaction & generation.
 * Throws InsufficientCreditsError if balance is too low.
 */
export async function reserveCredits(
  userId: string,
  creditCost: number,
  generationData: GenerationCreateData,
): Promise<{ generationId: string }> {
  return prisma.$transaction(async (tx) => {
    await spendCredits(tx, userId, creditCost);

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true },
    });

    const generation = await tx.generation.create({
      data: { ...generationData, creditCost },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -creditCost,
        balanceAfter: user.creditBalance,
        type: "RESERVE",
        description: `Generation: ${generationData.model} x${generationData.imageCount}`,
        generationId: generation.id,
      },
    });

    return { generationId: generation.id };
  });
}

/**
 * Atomically spend credits from pools and update an existing generation for extension.
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
    await spendCredits(tx, userId, creditCost);

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true },
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
        balanceAfter: user.creditBalance,
        type: "RESERVE",
        description: `Extend generation: +${additionalImageCount} images`,
        generationId,
      },
    });
  });
}

/**
 * Atomically spend one AI fill credit from pools and create a transaction record.
 * Throws InsufficientCreditsError if balance is too low.
 */
export async function reserveAiFillCredits(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await spendCredits(tx, userId, AI_FILL_CREDIT_COST);

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "RESERVE",
        amount: -AI_FILL_CREDIT_COST,
        balanceAfter: user.creditBalance,
        description: "AI attribute generation",
      },
    });
  });
}

export async function refundCredits(
  userId: string,
  generationId: string,
  creditCost: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.creditPool.create({
      data: {
        userId,
        source: "REFUND",
        originalAmount: creditCost,
        remaining: creditCost,
        priority: 1,
        expiresAt: null,
      },
    });

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
        description: "Generation cancelled — credits refunded",
        generationId,
      },
    });
  });
}

export async function grantCredits(
  userId: string,
  amount: number,
  description: string,
  pool: PoolParams,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.creditPool.create({
      data: {
        userId,
        source: pool.source,
        originalAmount: amount,
        remaining: amount,
        priority: pool.priority,
        expiresAt: pool.expiresAt,
      },
    });

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
