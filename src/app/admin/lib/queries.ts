import { prisma } from "@/lib/prisma";
import { PLAN_PRICES } from "@/lib/constants";

// ──────────────────────────────────────────
// Revenue queries
// ──────────────────────────────────────────

export async function getSubscribersByTier() {
  const result = await prisma.user.groupBy({
    by: ["tier"],
    _count: { id: true },
  });
  return result.map((r) => ({ tier: r.tier, count: r._count.id }));
}

export async function getEstimatedMRR() {
  const subscribers = await prisma.user.groupBy({
    by: ["tier"],
    where: { subscriptionStatus: "active" },
    _count: { id: true },
  });
  return subscribers.reduce((total, s) => {
    const price = PLAN_PRICES[s.tier] ?? 0;
    return total + price * s._count.id;
  }, 0);
}

// Maps credit amounts from CREDIT_PACKS to their dollar prices
const CREDIT_AMOUNT_TO_PRICE: Record<number, number> = {
  50: 5, 100: 9, 250: 20, 500: 35,
};

export async function getCreditPackRevenue(startDate: Date, endDate: Date) {
  const pools = await prisma.creditPool.findMany({
    where: {
      source: "PURCHASE",
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { originalAmount: true, createdAt: true },
  });
  return pools.map((p) => ({
    credits: p.originalAmount,
    dollarAmount: CREDIT_AMOUNT_TO_PRICE[p.originalAmount] ?? 0,
    createdAt: p.createdAt,
  }));
}

export async function getCreditPackRevenueTotal(startDate: Date, endDate: Date) {
  const packs = await getCreditPackRevenue(startDate, endDate);
  return packs.reduce((sum, p) => sum + p.dollarAmount, 0);
}

// ──────────────────────────────────────────
// AI Cost queries
// ──────────────────────────────────────────

export async function getApiCostsByType(startDate: Date, endDate: Date) {
  const result = await prisma.apiUsage.groupBy({
    by: ["type"],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum: { estimatedCostUsd: true, promptTokens: true, candidatesTokens: true, totalTokens: true },
    _count: { id: true },
  });
  return result.map((r) => ({
    type: r.type,
    count: r._count.id,
    totalCostUsd: r._sum.estimatedCostUsd?.toNumber() ?? 0,
    promptTokens: r._sum.promptTokens ?? 0,
    candidatesTokens: r._sum.candidatesTokens ?? 0,
    totalTokens: r._sum.totalTokens ?? 0,
  }));
}

export async function getApiCostsByModel(startDate: Date, endDate: Date) {
  const result = await prisma.apiUsage.groupBy({
    by: ["model"],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum: { estimatedCostUsd: true, totalTokens: true },
    _count: { id: true },
  });
  return result.map((r) => ({
    model: r.model,
    count: r._count.id,
    totalCostUsd: r._sum.estimatedCostUsd?.toNumber() ?? 0,
    totalTokens: r._sum.totalTokens ?? 0,
  }));
}

export async function getRetryCost(startDate: Date, endDate: Date) {
  const result = await prisma.apiUsage.aggregate({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      attempt: { gt: 1 },
    },
    _sum: { estimatedCostUsd: true },
    _count: { id: true },
  });
  return {
    totalCostUsd: result._sum.estimatedCostUsd?.toNumber() ?? 0,
    count: result._count.id,
  };
}

export async function getDailyCosts(startDate: Date, endDate: Date) {
  const usages = await prisma.apiUsage.findMany({
    where: { createdAt: { gte: startDate, lte: endDate } },
    select: { type: true, estimatedCostUsd: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap = new Map<string, Record<string, number>>();
  for (const u of usages) {
    const day = u.createdAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(day) ?? { GENERATION: 0, AI_FILL: 0, AI_EDIT: 0 };
    entry[u.type] = (entry[u.type] ?? 0) + (u.estimatedCostUsd?.toNumber() ?? 0);
    dailyMap.set(day, entry);
  }

  return Array.from(dailyMap.entries()).map(([date, costs]) => ({ date, ...costs }));
}

export async function getTotalCreditsConsumed(startDate: Date, endDate: Date) {
  const result = await prisma.creditTransaction.aggregate({
    where: {
      type: "RESERVE",
      createdAt: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });
  return Math.abs(result._sum.amount ?? 0);
}

// ──────────────────────────────────────────
// Anomaly queries
// ──────────────────────────────────────────

export async function getMoneyLeaks() {
  const refundedGenerations = await prisma.creditTransaction.findMany({
    where: { type: "REFUND", generationId: { not: null } },
    select: { generationId: true },
    distinct: ["generationId"],
  });

  const leaks = [];
  for (const { generationId } of refundedGenerations) {
    if (!generationId) continue;
    const failedCalls = await prisma.apiUsage.count({
      where: { generationId, success: false },
    });
    if (failedCalls === 0) {
      const successCalls = await prisma.apiUsage.count({
        where: { generationId, success: true },
      });
      if (successCalls > 0) leaks.push(generationId);
    }
  }
  return leaks;
}

export async function getUserOvercharged() {
  const failedGens = await prisma.generation.findMany({
    where: { status: "FAILED", creditCost: { gt: 0 } },
    select: { id: true, creditCost: true, createdAt: true },
  });

  const overcharged = [];
  for (const gen of failedGens) {
    const refundCount = await prisma.creditTransaction.count({
      where: { generationId: gen.id, type: "REFUND" },
    });
    if (refundCount === 0) overcharged.push(gen);
  }
  return overcharged;
}

export async function getDuplicateRefunds() {
  const result = await prisma.creditTransaction.groupBy({
    by: ["generationId"],
    where: { type: "REFUND", generationId: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  return result.map((r) => ({
    generationId: r.generationId,
    refundCount: r._count.id,
  }));
}

export async function getCreditBalanceDesyncs() {
  const users = await prisma.$queryRaw<
    Array<{ id: string; email: string; creditBalance: number; poolTotal: bigint }>
  >`
    SELECT u.id, u.email, u."creditBalance", COALESCE(SUM(cp.remaining), 0) AS "poolTotal"
    FROM "User" u
    LEFT JOIN "CreditPool" cp ON cp."userId" = u.id AND (cp."expiresAt" IS NULL OR cp."expiresAt" > NOW())
    GROUP BY u.id, u.email, u."creditBalance"
    HAVING u."creditBalance" != COALESCE(SUM(cp.remaining), 0)
  `;
  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    creditBalance: u.creditBalance,
    poolTotal: Number(u.poolTotal),
  }));
}

export async function getOrphanedProcessing() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const stuck = await prisma.generation.findMany({
    where: {
      status: "PROCESSING",
      createdAt: { lt: thirtyMinAgo },
    },
    select: { id: true, createdAt: true, projectId: true },
  });

  const orphaned = [];
  for (const gen of stuck) {
    const usageCount = await prisma.apiUsage.count({
      where: { generationId: gen.id },
    });
    if (usageCount === 0) orphaned.push(gen);
  }
  return orphaned;
}

export async function getCancellationRaces() {
  const cancelledGens = await prisma.generation.findMany({
    where: { status: "FAILED", errorMessage: { contains: "cancel" } },
    select: { id: true, createdAt: true },
  });

  const races = [];
  for (const gen of cancelledGens) {
    const refund = await prisma.creditTransaction.findFirst({
      where: { generationId: gen.id, type: "REFUND" },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (!refund) continue;

    const lateSuccess = await prisma.apiUsage.count({
      where: {
        generationId: gen.id,
        success: true,
        createdAt: { gt: refund.createdAt },
      },
    });
    if (lateSuccess > 0) races.push(gen.id);
  }
  return races;
}
