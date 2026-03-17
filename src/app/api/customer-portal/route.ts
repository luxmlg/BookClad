import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dodo } from "@/lib/dodo";

export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { dodoCustomerId: true },
  });

  if (!user.dodoCustomerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  const portal = await dodo.customers.customerPortal.create(user.dodoCustomerId);

  return NextResponse.json({ portalUrl: portal.link });
}
