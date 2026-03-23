"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { QuickCreateForm } from "./quick-create-form";
import { BriefWizard } from "./brief-wizard";

interface CreatePageClientProps {
  tier: string;
  creditBalance: number;
}

export function CreatePageClient({
  tier,
  creditBalance,
}: CreatePageClientProps) {
  const [mode, setMode] = useState<"quick" | "advanced">("quick");

  if (mode === "advanced") {
    return (
      <div>
        <button
          onClick={() => setMode("quick")}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quick Create
        </button>
        <BriefWizard />
      </div>
    );
  }

  return (
    <QuickCreateForm
      tier={tier}
      creditBalance={creditBalance}
      onSwitchToAdvanced={() => setMode("advanced")}
    />
  );
}
