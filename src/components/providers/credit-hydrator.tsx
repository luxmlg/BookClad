"use client";

import { useEffect, useRef } from "react";
import { useCreditStore } from "@/lib/stores/credit-store";

interface CreditHydratorProps {
  balance: number;
}

export function CreditHydrator({ balance }: CreditHydratorProps) {
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      useCreditStore.getState().setBalance(balance);
      hydrated.current = true;
    }
  }, [balance]);

  return null;
}
