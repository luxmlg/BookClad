"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useCreditStore } from "@/lib/stores/credit-store";

export function CreditPill() {
  const balance = useCreditStore((s) => s.balance);

  return (
    <Link
      href="/settings?tab=billing"
      className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1 text-sm font-medium transition-colors hover:bg-muted"
    >
      <Coins className="size-3.5 text-yellow-500" />
      <span className="tabular-nums">{balance}</span>
    </Link>
  );
}
