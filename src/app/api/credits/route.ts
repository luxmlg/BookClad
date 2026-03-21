import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);

  const [user, transactions, totalCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        creditBalance: true,
        tier: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        dodoSubscriptionId: true,
      },
    }),
    prisma.creditTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        amount: true,
        balanceAfter: true,
        type: true,
        description: true,
        createdAt: true,
      },
    }),
    prisma.creditTransaction.count({
      where: { userId: session.user.id },
    }),
  ]);

  return NextResponse.json({
    balance: user?.creditBalance ?? 0,
    tier: user?.tier ?? "FREE",
    subscriptionStatus: user?.subscriptionStatus ?? null,
    currentPeriodEnd: user?.currentPeriodEnd?.toISOString() ?? null,
    dodoSubscriptionId: user?.dodoSubscriptionId ?? null,
    transactions,
    page,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
  });
}
