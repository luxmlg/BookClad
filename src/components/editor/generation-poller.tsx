"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { useGenerationProgress } from "@/lib/use-generation-ws";

interface GenerationPollerProps {
  generationId: string;
  onComplete?: (generationId: string, status: "COMPLETED" | "FAILED") => void;
  compact?: boolean;
}

export function GenerationPoller({ generationId, onComplete, compact }: GenerationPollerProps) {
  const router = useRouter();
  const { status, progressMessage, step, totalSteps } = useGenerationProgress(generationId);
  const completedRef = useRef(false);

  // Polling fallback: check DB every 5s in case WebSocket is broken
  useEffect(() => {
    const pollTimer = setInterval(async () => {
      if (completedRef.current) return;
      try {
        const res = await fetch(`/api/generations/${generationId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "COMPLETED") {
          handleComplete();
        } else if (data.status === "FAILED") {
          handleComplete("Generation failed. Please try again.");
        }
      } catch {
        // Ignore fetch errors
      }
    }, 5000);

    return () => clearInterval(pollTimer);
  }, [generationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // React to WebSocket status changes
  useEffect(() => {
    if (completedRef.current) return;
    if (status === "COMPLETED") {
      handleComplete();
    } else if (status === "FAILED") {
      handleComplete("Generation failed. Please try again.");
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleComplete(failed?: string) {
    if (completedRef.current) return;
    completedRef.current = true;
    if (failed) {
      toast.error(failed);
      onComplete?.(generationId, "FAILED");
    } else {
      toast.success("Cover generation complete!");
      onComplete?.(generationId, "COMPLETED");
    }
    router.refresh();
  }

  const progressPercent =
    totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  if (compact) {
    if (status === "COMPLETED") {
      return (
        <div className="flex items-center gap-3 p-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium">Loading results...</p>
        </div>
      );
    }
    if (status === "FAILED") return null;

    return (
      <div className="flex items-center gap-3 p-3">
        {status === "QUEUED" ? (
          <>
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium">Waiting in queue...</p>
          </>
        ) : (
          <>
            <div className="w-full max-w-[200px]">
              <Progress value={progressPercent} className="h-2" />
            </div>
            <p className="shrink-0 text-sm font-medium">
              {progressMessage || "Starting..."}
            </p>
            {totalSteps > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {step}/{totalSteps}
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  // Full-size layout
  if (status === "COMPLETED") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="font-medium">Loading results...</p>
      </div>
    );
  }

  if (status === "FAILED") return null;

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      {status === "QUEUED" ? (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div>
            <p className="font-medium">Waiting in queue...</p>
            <p className="text-sm text-muted-foreground">
              Your generation will start shortly
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="w-full max-w-xs space-y-3">
            <Progress value={progressPercent} />
            <div className="text-center">
              <p className="font-medium">
                {progressMessage || "Starting generation..."}
              </p>
              <p className="text-sm text-muted-foreground">
                {totalSteps > 0
                  ? `Step ${step} of ${totalSteps}`
                  : "This may take 15-30 seconds"}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
