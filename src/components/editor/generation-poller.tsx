"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { useGenerationProgress } from "@/lib/use-generation-ws";
import { GENERATION_STATUS, POLL_INTERVAL_MS, type GenerationStatus } from "@/lib/constants";
import { getGeneration } from "@/lib/api";

interface UseGenerationPollerOptions {
  generationId: string;
  onComplete?: (generationId: string, status: GenerationStatus) => void;
}

export interface GenerationPollerState {
  status: GenerationStatus;
  progressMessage: string | null;
  step: number;
  totalSteps: number;
  progressPercent: number;
}

export function useGenerationPoller({ generationId, onComplete }: UseGenerationPollerOptions): GenerationPollerState {
  const router = useRouter();
  const { status, progressMessage, step, totalSteps } = useGenerationProgress(generationId);
  const completedRef = useRef(false);

  const handleComplete = (failed?: string) => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (failed) {
      toast.error(failed);
      onComplete?.(generationId, GENERATION_STATUS.FAILED);
    } else {
      toast.success("Cover generation complete!");
      onComplete?.(generationId, GENERATION_STATUS.COMPLETED);
    }
    router.refresh();
  };

  // Polling fallback: check DB every 5s in case WebSocket is broken
  useEffect(() => {
    const pollTimer = setInterval(async () => {
      if (completedRef.current) return;
      try {
        const data = await getGeneration(generationId);
        if (data.status === GENERATION_STATUS.COMPLETED) {
          handleComplete();
        } else if (data.status === GENERATION_STATUS.FAILED) {
          handleComplete("Generation failed. Please try again.");
        }
      } catch {
        // Ignore fetch errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollTimer);
  }, [generationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // React to WebSocket status changes
  useEffect(() => {
    if (completedRef.current) return;
    if (status === GENERATION_STATUS.COMPLETED) {
      handleComplete();
    } else if (status === GENERATION_STATUS.FAILED) {
      handleComplete("Generation failed. Please try again.");
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressPercent =
    totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  return { status, progressMessage, step, totalSteps, progressPercent };
}

interface GenerationPollerProps {
  generationId: string;
  onComplete?: (generationId: string, status: GenerationStatus) => void;
}

export function GenerationPoller({ generationId, onComplete }: GenerationPollerProps) {
  const { status, progressMessage, step, totalSteps, progressPercent } = useGenerationPoller({ generationId, onComplete });

  // Full-size layout
  if (status === GENERATION_STATUS.COMPLETED) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="font-medium">Loading results...</p>
      </div>
    );
  }

  if (status === GENERATION_STATUS.FAILED) return null;

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      {status === GENERATION_STATUS.QUEUED ? (
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
