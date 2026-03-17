import DodoPayments from "dodopayments";

export const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") ?? "test_mode",
});

export const DODO_PRODUCT_IDS: Record<string, string> = {
  STARTER: process.env.DODO_PRODUCT_ID_STARTER ?? "",
  PRO: process.env.DODO_PRODUCT_ID_PRO ?? "",
};

const PRODUCT_ID_TO_TIER: Record<string, string> = Object.fromEntries(
  Object.entries(DODO_PRODUCT_IDS).map(([tier, productId]) => [productId, tier]),
);

export function tierFromProductId(productId: string): "STARTER" | "PRO" | null {
  const tier = PRODUCT_ID_TO_TIER[productId];
  if (tier === "STARTER" || tier === "PRO") return tier;
  return null;
}

export function productIdFromTier(tier: string): string | null {
  return DODO_PRODUCT_IDS[tier] || null;
}

export const DODO_CREDIT_PACK_IDS: Record<string, string> = {
  CREDITS_50: process.env.DODO_PRODUCT_ID_CREDITS_50 ?? "",
  CREDITS_100: process.env.DODO_PRODUCT_ID_CREDITS_100 ?? "",
  CREDITS_250: process.env.DODO_PRODUCT_ID_CREDITS_250 ?? "",
};

const CREDIT_PACK_PRODUCT_TO_CREDITS: Record<string, number> = Object.fromEntries(
  Object.entries(DODO_CREDIT_PACK_IDS)
    .filter(([, pid]) => pid)
    .map(([packId, productId]) => {
      const amount = parseInt(packId.replace("CREDITS_", ""), 10);
      return [productId, amount];
    }),
);

export function creditsFromProductId(productId: string): number | null {
  return CREDIT_PACK_PRODUCT_TO_CREDITS[productId] ?? null;
}
