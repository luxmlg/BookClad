import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dodo, tierFromProductId, creditsFromProductId } from "@/lib/dodo";
import { grantCredits } from "@/lib/credits";
import { TIER_CREDITS, SUBSCRIPTION_STATUS } from "@/lib/constants";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";

type SubscriptionEvent = Extract<
  UnwrapWebhookEvent,
  { data: { customer: { customer_id: string }; subscription_id: string; product_id: string } }
>;

function isSubscriptionEvent(event: UnwrapWebhookEvent): event is SubscriptionEvent {
  return (
    "data" in event &&
    event.data !== null &&
    typeof event.data === "object" &&
    "subscription_id" in event.data &&
    "customer" in event.data
  );
}

async function findUserByDodoCustomer(customerId: string): Promise<{ id: string; tier: string; dodoSubscriptionId: string | null; lastPlanChangeAt: Date | null } | null> {
  return prisma.user.findUnique({
    where: { dodoCustomerId: customerId },
    select: { id: true, tier: true, dodoSubscriptionId: true, lastPlanChangeAt: true },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const webhookId = request.headers.get("webhook-id");
  const webhookSignature = request.headers.get("webhook-signature");
  const webhookTimestamp = request.headers.get("webhook-timestamp");

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
  }

  let event: UnwrapWebhookEvent;
  try {
    event = dodo.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": webhookSignature,
        "webhook-timestamp": webhookTimestamp,
      },
    });
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.log(`[webhook] Received ${event.type} (id: ${webhookId})`);

  // Idempotency: atomically claim the webhook via unique constraint
  try {
    await prisma.webhookEvent.create({
      data: { id: webhookId, eventType: event.type, processed: false },
    });
  } catch (err) {
    // Unique constraint violation — another request already claimed this webhook
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      const existing = await prisma.webhookEvent.findUnique({ where: { id: webhookId } });
      if (existing?.processed) {
        return NextResponse.json({ received: true });
      }
      // Not yet processed but claimed — another request is handling it
      return NextResponse.json({ received: true });
    }
    throw err;
  }

  try {
    switch (event.type) {
      case "subscription.active":
        await handleSubscriptionActive(event, webhookId);
        break;
      case "subscription.renewed":
        await handleSubscriptionRenewed(event, webhookId);
        break;
      case "subscription.cancelled":
        await handleSubscriptionCancelled(event, webhookId);
        break;
      case "subscription.expired":
        await handleSubscriptionExpired(event, webhookId);
        break;
      case "subscription.on_hold":
        await handleSubscriptionOnHold(event, webhookId);
        break;
      case "subscription.plan_changed":
        await handleSubscriptionPlanChanged(event, webhookId);
        break;
      case "payment.succeeded":
        await handlePaymentSucceeded(event, webhookId);
        break;
      default:
        // Mark unhandled events as processed
        await prisma.webhookEvent.update({
          where: { id: webhookId },
          data: { processed: true },
        });
    }
  } catch (error) {
    console.error(`Webhook handler error for ${event.type}:`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionActive(
  event: UnwrapWebhookEvent & { type: "subscription.active" },
  webhookId: string,
): Promise<void> {
  if (!isSubscriptionEvent(event)) return;

  const { subscription_id, product_id, customer, next_billing_date } = event.data;
  const tier = tierFromProductId(product_id);
  if (!tier) return;

  const user = await findUserByDodoCustomer(customer.customer_id);
  if (!user) return;

  // Cancel old subscription if a new one is activating (safety net for duplicate subscriptions)
  if (user.dodoSubscriptionId && user.dodoSubscriptionId !== subscription_id) {
    try {
      await dodo.subscriptions.update(user.dodoSubscriptionId, {
        cancel_at_next_billing_date: true,
      });
      console.log(`[webhook] Cancelled old subscription ${user.dodoSubscriptionId} for user ${user.id}`);
    } catch (err) {
      console.error(`[webhook] Failed to cancel old subscription ${user.dodoSubscriptionId}:`, err);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        tier,
        dodoSubscriptionId: subscription_id,
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: new Date(next_billing_date),
      },
    });
    await tx.webhookEvent.update({
      where: { id: webhookId },
      data: { processed: true },
    });
  });

  // Credits are granted by handleSubscriptionRenewed, not here.
  // DodoPayments fires both subscription.active and subscription.renewed
  // on initial activation — granting here would double-count.
}

async function handleSubscriptionRenewed(
  event: UnwrapWebhookEvent & { type: "subscription.renewed" },
  webhookId: string,
): Promise<void> {
  if (!isSubscriptionEvent(event)) return;

  const { customer, product_id, next_billing_date } = event.data;
  const tier = tierFromProductId(product_id);
  if (!tier) return;

  const user = await findUserByDodoCustomer(customer.customer_id);
  if (!user) return;

  // Skip credit grant if this renewal was triggered by a plan change
  const PLAN_CHANGE_WINDOW = 5 * 60 * 1000;
  const recentPlanChange = user.lastPlanChangeAt &&
    Date.now() - new Date(user.lastPlanChangeAt).getTime() < PLAN_CHANGE_WINDOW;

  const tierCredits = TIER_CREDITS[tier] ?? 0;
  const currentPeriodEnd = new Date(next_billing_date);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd,
      },
    });

    if (!recentPlanChange) {
      // Zero out old subscription pools (no rollover)
      const oldPools = await tx.creditPool.findMany({
        where: { userId: user.id, source: "SUBSCRIPTION", remaining: { gt: 0 } },
      });
      const oldRemaining = oldPools.reduce((sum, p) => sum + p.remaining, 0);

      if (oldRemaining > 0) {
        await tx.creditPool.updateMany({
          where: { userId: user.id, source: "SUBSCRIPTION", remaining: { gt: 0 } },
          data: { remaining: 0 },
        });
      }

      // Create new subscription pool
      await tx.creditPool.create({
        data: {
          userId: user.id,
          source: "SUBSCRIPTION",
          originalAmount: tierCredits,
          remaining: tierCredits,
          priority: 0,
          expiresAt: currentPeriodEnd,
        },
      });

      // Update balance: remove old, add new
      const balanceDelta = tierCredits - oldRemaining;
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { creditBalance: { increment: balanceDelta } },
      });

      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: tierCredits,
          balanceAfter: updatedUser.creditBalance,
          type: "GRANT",
          description: `Subscription renewed: ${tier} plan`,
        },
      });
    }

    await tx.webhookEvent.update({
      where: { id: webhookId },
      data: { processed: true },
    });
  });
}

async function handleSubscriptionCancelled(
  event: UnwrapWebhookEvent & { type: "subscription.cancelled" },
  webhookId: string,
): Promise<void> {
  if (!isSubscriptionEvent(event)) return;

  const { customer, next_billing_date } = event.data;
  const user = await findUserByDodoCustomer(customer.customer_id);
  if (!user) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SUBSCRIPTION_STATUS.CANCELLED,
        currentPeriodEnd: new Date(next_billing_date),
      },
    });
    await tx.webhookEvent.update({
      where: { id: webhookId },
      data: { processed: true },
    });
  });
}

async function handleSubscriptionExpired(
  event: UnwrapWebhookEvent & { type: "subscription.expired" },
  webhookId: string,
): Promise<void> {
  if (!isSubscriptionEvent(event)) return;

  const { customer } = event.data;
  const user = await findUserByDodoCustomer(customer.customer_id);
  if (!user) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        tier: "FREE",
        subscriptionStatus: SUBSCRIPTION_STATUS.EXPIRED,
        dodoSubscriptionId: null,
        currentPeriodEnd: null,
      },
    });
    await tx.webhookEvent.update({
      where: { id: webhookId },
      data: { processed: true },
    });
  });
}

async function handleSubscriptionOnHold(
  event: UnwrapWebhookEvent & { type: "subscription.on_hold" },
  webhookId: string,
): Promise<void> {
  if (!isSubscriptionEvent(event)) return;

  const { customer } = event.data;
  const user = await findUserByDodoCustomer(customer.customer_id);
  if (!user) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: SUBSCRIPTION_STATUS.ON_HOLD },
    });
    await tx.webhookEvent.update({
      where: { id: webhookId },
      data: { processed: true },
    });
  });
}

async function handleSubscriptionPlanChanged(
  event: UnwrapWebhookEvent & { type: "subscription.plan_changed" },
  webhookId: string,
): Promise<void> {
  if (!isSubscriptionEvent(event)) return;

  const { customer, product_id } = event.data;
  const newTier = tierFromProductId(product_id);
  if (!newTier) return;

  const user = await findUserByDodoCustomer(customer.customer_id);
  if (!user) return;

  const newCredits = TIER_CREDITS[newTier] ?? 0;

  // Use currentPeriodEnd from User record — plan_changed events may not include next_billing_date
  const fullUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { currentPeriodEnd: true },
  });
  const currentPeriodEnd = fullUser.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    // Zero out old subscription pools
    const oldPools = await tx.creditPool.findMany({
      where: { userId: user.id, source: "SUBSCRIPTION", remaining: { gt: 0 } },
    });
    const oldRemaining = oldPools.reduce((sum, p) => sum + p.remaining, 0);

    if (oldRemaining > 0) {
      await tx.creditPool.updateMany({
        where: { userId: user.id, source: "SUBSCRIPTION", remaining: { gt: 0 } },
        data: { remaining: 0 },
      });
    }

    // Create new subscription pool with full tier credits
    await tx.creditPool.create({
      data: {
        userId: user.id,
        source: "SUBSCRIPTION",
        originalAmount: newCredits,
        remaining: newCredits,
        priority: 0,
        expiresAt: currentPeriodEnd,
      },
    });

    // Update balance: remove old, add new
    const balanceDelta = newCredits - oldRemaining;
    await tx.user.update({
      where: { id: user.id },
      data: {
        tier: newTier,
        creditBalance: { increment: balanceDelta },
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
        lastPlanChangeAt: new Date(),
      },
    });

    const updatedUser = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { creditBalance: true },
    });

    await tx.creditTransaction.create({
      data: {
        userId: user.id,
        amount: balanceDelta,
        balanceAfter: updatedUser.creditBalance,
        type: "GRANT",
        description: `Plan changed to ${newTier}: ${newCredits} credits`,
      },
    });

    await tx.webhookEvent.update({
      where: { id: webhookId },
      data: { processed: true },
    });
  });
}

async function handlePaymentSucceeded(
  event: UnwrapWebhookEvent & { type: "payment.succeeded" },
  webhookId: string,
): Promise<void> {
  const { metadata, customer } = event.data;

  // Only handle credit pack purchases — subscription payments are handled by subscription events
  if (metadata?.type !== "credit_pack") {
    console.log(`[webhook] payment.succeeded: not a credit pack, skipping`);
    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: { processed: true },
    });
    return;
  }

  const userId = metadata.userId;
  if (!userId) {
    console.error(`[webhook] payment.succeeded: missing userId in metadata`, metadata);
    return;
  }

  // Derive credit amount from product_id (defense-in-depth: don't trust metadata.credits)
  const productCart = event.data.product_cart;
  const productId = productCart?.[0]?.product_id;
  const credits = productId ? creditsFromProductId(productId) : null;
  if (!credits) {
    console.error(`[webhook] payment.succeeded: could not derive credits from product_id ${productId}`, metadata);
    return;
  }

  // Verify user exists (prefer metadata userId, fall back to customer lookup)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    ?? await findUserByDodoCustomer(customer.customer_id);
  if (!user) {
    console.error(`[webhook] payment.succeeded: no user found (userId: ${userId}, customer: ${customer.customer_id})`);
    return;
  }

  console.log(`[webhook] payment.succeeded: granting ${credits} credits to user ${user.id}`);

  await prisma.webhookEvent.update({
    where: { id: webhookId },
    data: { processed: true },
  });

  const twelveMonthsFromNow = new Date();
  twelveMonthsFromNow.setFullYear(twelveMonthsFromNow.getFullYear() + 1);

  await grantCredits(user.id, credits, `Credit pack: ${credits} credits`, {
    source: "PURCHASE",
    expiresAt: twelveMonthsFromNow,
    priority: 1,
  });
}
