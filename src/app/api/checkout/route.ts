import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dodo, productIdFromTier, DODO_CREDIT_PACK_IDS } from "@/lib/dodo";
import { CREDIT_PACKS } from "@/lib/constants";

const packIds = CREDIT_PACKS.map((p) => p.id) as [string, ...string[]];

const checkoutSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscription"), tier: z.enum(["STARTER", "PRO"]) }),
  z.object({ type: z.literal("credits"), packId: z.enum(packIds) }),
]);

async function ensureDodoCustomer(user: {
  id: string;
  email: string;
  name: string | null;
  dodoCustomerId: string | null;
}): Promise<string> {
  if (user.dodoCustomerId) return user.dodoCustomerId;

  const customer = await dodo.customers.create({
    email: user.email,
    name: user.name ?? user.email,
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { dodoCustomerId: customer.customer_id },
  });
  return customer.customer_id;
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, tier: true, dodoCustomerId: true },
  });

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings?tab=billing&checkout=success`;

  const data = parsed.data;
  let productId: string;
  let metadata: Record<string, string>;

  if (data.type === "subscription") {
    if (user.tier === data.tier) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
    }
    const pid = productIdFromTier(data.tier);
    if (!pid) {
      return NextResponse.json({ error: "Product not configured" }, { status: 500 });
    }
    productId = pid;
    metadata = { type: "subscription", userId: user.id, tier: data.tier };
  } else {
    const pid = DODO_CREDIT_PACK_IDS[data.packId];
    if (!pid) {
      return NextResponse.json({ error: "Credit pack not configured" }, { status: 500 });
    }
    const pack = CREDIT_PACKS.find((p) => p.id === data.packId);
    productId = pid;
    metadata = {
      type: "credit_pack",
      userId: user.id,
      packId: data.packId,
      credits: String(pack?.credits ?? 0),
    };
  }

  const customerId = await ensureDodoCustomer(user);

  const checkoutSession = await dodo.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: { customer_id: customerId },
    return_url: returnUrl,
    metadata,
  });

  if (!checkoutSession.checkout_url) {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl: checkoutSession.checkout_url });
}
