import api from "./client";

export interface CheckoutResponse {
  checkoutUrl: string;
}

export interface CustomerPortalResponse {
  portalUrl: string;
}

export async function createCheckout(tier: "STARTER" | "PRO"): Promise<CheckoutResponse> {
  const { data } = await api.post<CheckoutResponse>("/api/checkout", { type: "subscription", tier });
  return data;
}

export async function createCreditPackCheckout(packId: string): Promise<CheckoutResponse> {
  const { data } = await api.post<CheckoutResponse>("/api/checkout", { type: "credits", packId });
  return data;
}

export async function createCustomerPortal(): Promise<CustomerPortalResponse> {
  const { data } = await api.post<CustomerPortalResponse>("/api/customer-portal");
  return data;
}
