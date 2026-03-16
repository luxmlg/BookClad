import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { creditBalance: true, tier: true },
    }),
    prisma.creditTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amount: true,
        balanceAfter: true,
        type: true,
        description: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    balance: user?.creditBalance ?? 0,
    tier: user?.tier ?? "FREE",
    transactions,
  });
}
