"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Coins, ExternalLink, AlertTriangle, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCredits, type CreditTransaction } from "@/lib/api/credits";
import { createCheckout, createCreditPackCheckout, createCustomerPortal } from "@/lib/api/checkout";
import { TIER_CREDITS, PLAN_PRICES, CREDIT_PACKS, SUBSCRIPTION_STATUS } from "@/lib/constants";
import { useCreditStore } from "@/lib/stores/credit-store";

const TXN_TYPE_LABEL: Record<string, string> = {
  GRANT: "Credit",
  RESERVE: "Used",
  REFUND: "Refund",
  EXPIRE: "Expired",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  [SUBSCRIPTION_STATUS.ACTIVE]: { label: "Active", variant: "default" },
  [SUBSCRIPTION_STATUS.ON_HOLD]: { label: "Payment Failed", variant: "destructive" },
  [SUBSCRIPTION_STATUS.CANCELLED]: { label: "Cancelled", variant: "secondary" },
  [SUBSCRIPTION_STATUS.EXPIRED]: { label: "Expired", variant: "outline" },
};

const PLAN_FEATURES: Record<string, string[]> = {
  STARTER: ["100 credits / month", "All AI models", "Priority support"],
  PRO: ["250 credits / month", "All AI models", "Priority support", "Early access to features"],
};

export function BillingTab() {
  const [balance, setBalance] = useState(0);
  const [tier, setTier] = useState("FREE");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [txnPage, setTxnPage] = useState(1);
  const [txnTotalPages, setTxnTotalPages] = useState(1);
  const [txnLoading, setTxnLoading] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const initialSnapshotRef = useRef<{ balance: number; tier: string; txnCount: number } | null>(null);

  const applyCreditsData = useCallback((data: Awaited<ReturnType<typeof getCredits>>) => {
    setBalance(data.balance);
    setTier(data.tier);
    setSubscriptionStatus(data.subscriptionStatus);
    setCurrentPeriodEnd(data.currentPeriodEnd);
    setHasSubscription(!!data.dodoSubscriptionId);
    setTransactions(data.transactions);
    setTxnPage(data.page);
    setTxnTotalPages(data.totalPages);
  }, []);

  // Detect checkout=success in URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get("checkout") === "success" ||
        params.get("status") === "succeeded" ||
        params.has("subscription_id")
      ) {
        setShowSuccess(true);
        const url = new URL(window.location.href);
        url.searchParams.delete("checkout");
        url.searchParams.delete("status");
        url.searchParams.delete("payment_id");
        url.searchParams.delete("email");
        url.searchParams.delete("subscription_id");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    getCredits()
      .then((data) => {
        applyCreditsData(data);
        initialSnapshotRef.current = {
          balance: data.balance,
          tier: data.tier,
          txnCount: data.transactions.length,
        };
      })
      .catch(() => toast.error("Failed to load billing info"))
      .finally(() => setLoading(false));
  }, [applyCreditsData]);

  // Poll for updates after checkout success
  useEffect(() => {
    if (!showSuccess) return;

    const POLL_INTERVAL = 2000;
    const MAX_DURATION = 60000;
    const start = Date.now();

    const interval = setInterval(async () => {
      if (Date.now() - start > MAX_DURATION) {
        clearInterval(interval);
        setShowSuccess(false);
        return;
      }
      try {
        const data = await getCredits();
        const snap = initialSnapshotRef.current;
        const changed =
          !snap ||
          data.balance !== snap.balance ||
          data.tier !== snap.tier ||
          data.transactions.length !== snap.txnCount;

        applyCreditsData(data);

        if (changed) {
          clearInterval(interval);
          setShowSuccess(false);
          useCreditStore.getState().refreshCredits();
        }
      } catch {
        // Silently retry on next interval
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [showSuccess, applyCreditsData]);

  async function handleUpgrade(targetTier: "STARTER" | "PRO") {
    setCheckoutLoading(targetTier);
    try {
      const result = await createCheckout(targetTier);
      if (result.planChanged) {
        setCheckoutLoading(null);
        setShowSuccess(true);
      } else {
        window.location.href = result.checkoutUrl;
      }
    } catch {
      toast.error("Failed to start checkout");
      setCheckoutLoading(null);
    }
  }

  async function handleBuyCredits(packId: string) {
    setCheckoutLoading(packId);
    try {
      const { checkoutUrl } = await createCreditPackCheckout(packId);
      window.location.href = checkoutUrl;
    } catch {
      toast.error("Failed to start checkout");
      setCheckoutLoading(null);
    }
  }

  async function handleTxnPageChange(page: number) {
    setTxnLoading(true);
    try {
      const data = await getCredits(page);
      setTransactions(data.transactions);
      setTxnPage(data.page);
      setTxnTotalPages(data.totalPages);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setTxnLoading(false);
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const { portalUrl } = await createCustomerPortal();
      window.open(portalUrl, "_blank");
    } catch {
      toast.error("Failed to open subscription portal");
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  const tierCredits = TIER_CREDITS[tier] ?? TIER_CREDITS.FREE;
  const statusBadge = subscriptionStatus ? STATUS_BADGE[subscriptionStatus] : null;
  const isActive = subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE;
  const isOnHold = subscriptionStatus === SUBSCRIPTION_STATUS.ON_HOLD;
  const isCancelled = subscriptionStatus === SUBSCRIPTION_STATUS.CANCELLED;

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {showSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-400">
          <Check className="size-4 shrink-0" />
          Payment is being processed. Your plan will update shortly.
        </div>
      )}

      {/* Payment failure warning */}
      {isOnHold && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          Payment failed. Please update your payment method to keep your plan.
          {hasSubscription && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              Update Payment
            </Button>
          )}
        </div>
      )}

      {/* Cancellation banner */}
      {isCancelled && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="size-4 shrink-0" />
          <div>
            Your {tier} plan has been cancelled.
            {currentPeriodEnd && (
              <> You&apos;ll have access until <strong>{new Date(currentPeriodEnd).toLocaleDateString()}</strong>.</>
            )}
            {" "}After that, you&apos;ll be on the Free plan ({TIER_CREDITS.FREE} credits/month).
          </div>
          {hasSubscription && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              Resubscribe
            </Button>
          )}
        </div>
      )}

      {/* Balance + plan cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-yellow-500/10 p-3">
              <Coins className="size-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Credit Balance</p>
              <p className="text-2xl font-bold">{balance}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{tier}</p>
                {statusBadge && (
                  <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{tierCredits} credits / month</p>
            </div>
            {hasSubscription && (isActive || isOnHold || isCancelled) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={portalLoading}
              >
                <ExternalLink className="mr-1 size-3" />
                Manage
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upgrade plans */}
      {tier !== "PRO" && (
        <div>
          <h3 className="mb-3 text-sm font-medium">Upgrade Your Plan</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["STARTER", "PRO"] as const).map((planTier) => {
              const isCurrent = tier === planTier;
              const price = PLAN_PRICES[planTier];
              const features = PLAN_FEATURES[planTier];

              return (
                <Card key={planTier} className={planTier === "PRO" ? "border-primary" : ""}>
                  <CardContent className="p-6">
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold">{planTier}</h4>
                      <p className="text-2xl font-bold">
                        ${price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                    </div>
                    <ul className="mb-4 space-y-1 text-sm text-muted-foreground">
                      {features.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <Check className="size-3 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={planTier === "PRO" ? "default" : "outline"}
                      disabled={isCurrent || checkoutLoading !== null}
                      onClick={() => handleUpgrade(planTier)}
                    >
                      {isCurrent
                        ? "Current Plan"
                        : checkoutLoading === planTier
                          ? "Redirecting..."
                          : `Upgrade to ${planTier}`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Buy credits */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Buy Credits</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id}>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Coins className="size-5 text-yellow-500" />
                  <p className="text-2xl font-bold">{pack.credits}</p>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">credits</p>
                <p className="mb-4 text-lg font-semibold">${pack.price}</p>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={checkoutLoading !== null}
                  onClick={() => handleBuyCredits(pack.id)}
                >
                  {checkoutLoading === pack.id ? "Redirecting..." : "Buy"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Transaction History</h3>
        {transactions.length === 0 && txnPage === 1 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <>
            <div className={`rounded-lg border${txnLoading ? " opacity-50" : ""}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Balance</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="border-b last:border-0">
                      <td className="px-4 py-2">{TXN_TYPE_LABEL[txn.type] ?? txn.type}</td>
                      <td className={`px-4 py-2 font-medium ${txn.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                        {txn.amount > 0 ? "+" : ""}{txn.amount}
                      </td>
                      <td className="px-4 py-2">{txn.balanceAfter}</td>
                      <td className="px-4 py-2 text-muted-foreground">{txn.description ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(txn.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {txnTotalPages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={txnPage <= 1 || txnLoading}
                  onClick={() => handleTxnPageChange(txnPage - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {Array.from({ length: txnTotalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === txnPage ? "default" : "outline"}
                    size="icon"
                    className="size-8 text-xs"
                    disabled={txnLoading}
                    onClick={() => handleTxnPageChange(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={txnPage >= txnTotalPages || txnLoading}
                  onClick={() => handleTxnPageChange(txnPage + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
