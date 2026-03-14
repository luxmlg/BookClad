"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface GenerationPollerProps {
  generationId: string;
}

type Status = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export function GenerationPoller({ generationId }: GenerationPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("QUEUED");
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (completedRef.current) return;

    const es = new EventSource(`/api/generations/${generationId}/events`);

    function handleComplete(failed?: string) {
      if (completedRef.current) return;
      completedRef.current = true;
      es.close();
      clearInterval(pollTimer);
      if (failed) {
        setStatus("FAILED");
        toast.error(failed);
      } else {
        setStatus("COMPLETED");
        toast.success("Cover generation complete!");
      }
      router.refresh();
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "status":
            setStatus(data.status);
            break;
          case "progress":
            setStatus("PROCESSING");
            setProgressMessage(data.message);
            setStep(data.step);
            setTotalSteps(data.totalSteps);
            break;
          case "completed":
            handleComplete();
            break;
          case "failed":
            handleComplete(
              data.error || "Generation failed. Please try again."
            );
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; we rely on the polling fallback for robustness
    };

    // Polling fallback: check DB every 5s in case SSE is broken
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/generations/${generationId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "COMPLETED") handleComplete();
        else if (data.status === "FAILED")
          handleComplete("Generation failed. Please try again.");
        else if (data.status === "PROCESSING") setStatus("PROCESSING");
      } catch {
        // Ignore fetch errors
      }
    }, 5000);

    return () => {
      es.close();
      clearInterval(pollTimer);
    };
  }, [generationId, router]);

  // Show loading state after completion (parent will unmount us)
  if (status === "COMPLETED") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="font-medium">Loading results...</p>
      </div>
    );
  }

  if (status === "FAILED") return null;

  const progressPercent =
    totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

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
