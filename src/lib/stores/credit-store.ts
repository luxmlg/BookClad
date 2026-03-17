import { create } from "zustand";
import { getCredits } from "@/lib/api/credits";

interface CreditState {
  balance: number;
  setBalance: (balance: number) => void;
  refreshCredits: () => Promise<void>;
}

export const useCreditStore = create<CreditState>((set) => ({
  balance: 0,
  setBalance: (balance) => set({ balance }),
  refreshCredits: async () => {
    try {
      const data = await getCredits();
      set({ balance: data.balance });
    } catch {
      // Silently fail — balance stays stale rather than breaking UI
    }
  },
}));
