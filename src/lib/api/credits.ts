import api from "./client";

export interface CreditTransaction {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  description: string | null;
  createdAt: string;
}

export interface CreditsResponse {
  balance: number;
  tier: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  dodoSubscriptionId: string | null;
  transactions: CreditTransaction[];
  page: number;
  totalPages: number;
}

export async function getCredits(page = 1): Promise<CreditsResponse> {
  const { data } = await api.get<CreditsResponse>("/api/credits", {
    params: page > 1 ? { page } : undefined,
  });
  return data;
}
