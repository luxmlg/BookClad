"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GENERATION_STATUS, POLL_INTERVAL_MS } from "@/lib/constants";
import { cancelGeneration } from "@/lib/api";
import { getModelLabel, formatRelativeTime } from "@/components/editor/generation-helpers";

interface ActiveGeneration {
  id: string;
  projectId: string;
  status: string;
  imageCount: number;
  model: string | null;
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: Date | string | null;
  errorMessage: string | null;
  createdAt: Date | string;
}

interface ActiveGenerationRowsProps {
  projectId: string;
  initialGenerations: ActiveGeneration[];
}

export function ActiveGenerationRows({ projectId, initialGenerations }: ActiveGenerationRowsProps) {
  const router = useRouter();
  const [generations, setGenerations] = useState(initialGenerations);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/generations/active?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setGenerations(data.generations);
          if (data.generations.length === 0) {
            router.refresh();
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [projectId, router]);

  if (generations.length === 0) return null;

  return (
    <div className="border-t border-border/50">
      {generations.map((gen) => (
        <DashboardGenRow
          key={gen.id}
          generation={gen}
          projectId={projectId}
          onCancelled={() => {
            setGenerations((prev) => prev.filter((g) => g.id !== gen.id));
            router.refresh();
          }}
        />
      ))}
    </div>
  );
}

interface DashboardGenRowProps {
  generation: ActiveGeneration;
  projectId: string;
  onCancelled: () => void;
}

function DashboardGenRow({ generation, projectId, onCancelled }: DashboardGenRowProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [countdown, setCountdown] = useState("");
  const isRetrying = generation.status === GENERATION_STATUS.RETRYING;
  const isHighDemand = generation.retryReason === "high_demand";

  useEffect(() => {
    if (!isRetrying || !generation.nextRetryAt) return;
    const target = new Date(generation.nextRetryAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setCountdown(`${remaining}s`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRetrying, generation.nextRetryAt]);

  const handleCancel = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setCancelling(true);
      try {
        await cancelGeneration(generation.id);
        toast.success("Generation cancelled — credits refunded");
        onCancelled();
      } catch {
        setCancelling(false);
        toast.error("Failed to cancel generation");
      }
    },
    [generation.id, onCancelled],
  );

  const handleClick = () => {
    router.push(`/editor/${projectId}?tab=history&gen=${generation.id}`);
  };

  const date =
    typeof generation.createdAt === "string"
      ? new Date(generation.createdAt)
      : generation.createdAt;

  const modelLabel = getModelLabel(generation.model ?? undefined);

  let dotColor = "bg-primary";
  let label = `Generating ${generation.imageCount} images`;
  if (isRetrying) {
    dotColor = isHighDemand ? "bg-amber-500" : "bg-destructive";
    label = isHighDemand
      ? `High demand · Retry ${generation.retryCount}`
      : `Retrying · Attempt ${generation.retryCount}`;
  }

  return (
    <div
      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors text-xs"
      onClick={handleClick}
    >
      <div className={`size-2 shrink-0 rounded-full ${dotColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span
            className={
              isRetrying
                ? isHighDemand
                  ? "text-amber-500"
                  : "text-destructive"
                : "text-muted-foreground"
            }
          >
            {label}
          </span>
          {isRetrying && countdown && (
            <span className="text-muted-foreground">· {countdown}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>
            {generation.imageCount} imgs{modelLabel ? ` · ${modelLabel}` : ""}
          </span>
          <span>· {formatRelativeTime(date)}</span>
        </div>
      </div>
      {!isRetrying && (
        <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
      )}
      {isRetrying && (
        <button
          className="shrink-0 rounded border border-destructive/40 px-1.5 py-0.5 text-[9px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
          onClick={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? "..." : "Cancel"}
        </button>
      )}
    </div>
  );
}
