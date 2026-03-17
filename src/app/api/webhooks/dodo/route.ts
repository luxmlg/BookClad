import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dodo, tierFromProductId } from "@/lib/dodo";
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

async function findUserByDodoCustomer(customerId: string): Promise<{ id: string; tier: string } | null> {
  return prisma.user.findUnique({
    where: { dodoCustomerId: customerId },
    select: { id: true, tier: true },
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

  // Idempotency: check if this webhook was already processed
  const existing = await prisma.webhookEvent.findUnique({ where: { id: webhookId } });
  if (existing?.processed) {
    return NextResponse.json({ received: true });
  }
  if (!existing) {
    await prisma.webhookEvent.create({
      data: { id: webhookId, eventType: event.type, processed: false },
    });
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

  await grantCredits(user.id, TIER_CREDITS[tier], `Subscription activated: ${tier} plan`);
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

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: new Date(next_billing_date),
      },
    });
    await tx.webhookEvent.update({
      where: { id: webhookId },
      data: { processed: true },
    });
  });

  await grantCredits(user.id, TIER_CREDITS[tier], `Subscription renewed: ${tier} plan`);
}

async function handleSubscriptionCancelled(
  event: UnwrapWebhookEvent & { type: "subscription.cancelled" },
  webhookId: string,
): Promise<void> {
  if (!isSubscriptionEvent(event)) return;

  const { customer } = event.data;
  const user = await findUserByDodoCustomer(customer.customer_id);
  if (!user) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: SUBSCRIPTION_STATUS.CANCELLED },
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

  const oldCredits = TIER_CREDITS[user.tier] ?? 0;
  const newCredits = TIER_CREDITS[newTier] ?? 0;
  const creditDiff = newCredits - oldCredits;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        tier: newTier,
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      },
    });
    await tx.webhookEvent.update({
      where: { id: webhookId },
      data: { processed: true },
    });
  });

  // Grant extra credits on upgrade, don't revoke on downgrade
  if (creditDiff > 0) {
    await grantCredits(user.id, creditDiff, `Plan upgraded to ${newTier}: +${creditDiff} credits`);
  }
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
  const credits = parseInt(metadata.credits, 10);
  if (!userId || !credits || isNaN(credits)) {
    console.error(`[webhook] payment.succeeded: invalid metadata`, metadata);
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

  await grantCredits(user.id, credits, `Credit pack: ${credits} credits`);
}
