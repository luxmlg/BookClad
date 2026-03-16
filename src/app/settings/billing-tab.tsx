"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getCredits, type CreditTransaction } from "@/lib/api/credits";
import { TIER_CREDITS } from "@/lib/constants";

const TXN_TYPE_LABEL: Record<string, string> = {
  GRANT: "Credit",
  RESERVE: "Used",
  REFUND: "Refund",
  EXPIRE: "Expired",
};

export function BillingTab() {
  const [balance, setBalance] = useState(0);
  const [tier, setTier] = useState("FREE");
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCredits()
      .then((data) => {
        setBalance(data.balance);
        setTier(data.tier);
        setTransactions(data.transactions);
      })
      .catch(() => toast.error("Failed to load billing info"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  const tierCredits = TIER_CREDITS[tier] ?? TIER_CREDITS.FREE;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-primary/10 p-3">
              <Coins className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Credit Balance</p>
              <p className="text-2xl font-bold">{balance}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-2xl font-bold">{tier}</p>
              <p className="text-xs text-muted-foreground">{tierCredits} credits / month</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium">Transaction History</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="rounded-lg border">
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
        )}
      </div>
    </div>
  );
}
