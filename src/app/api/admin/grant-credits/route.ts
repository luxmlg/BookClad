import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email || !ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { email: targetEmail, amount, description } = body as {
    email: string;
    amount: number;
    description?: string;
  };

  if (!targetEmail || !amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid email or amount" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: { id: true, name: true, creditBalance: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await grantCredits(user.id, amount, description || `Admin grant: ${amount} credits`, {
    source: "SIGNUP_GRANT",
    expiresAt: null,
    priority: 1,
  });

  return NextResponse.json({
    success: true,
    user: { name: user.name, email: targetEmail },
    amount,
    newBalance: user.creditBalance + amount,
  });
}
