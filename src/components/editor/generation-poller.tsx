"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface GenerationPollerProps {
  generationId: string;
  status: string;
}

export function GenerationPoller({
  generationId,
  status: initialStatus,
}: GenerationPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status === "COMPLETED" || status === "FAILED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/generations/${generationId}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);

        if (data.status === "COMPLETED") {
          clearInterval(interval);
          toast.success("Cover generation complete!");
          router.refresh();
        } else if (data.status === "FAILED") {
          clearInterval(interval);
          toast.error("Generation failed. Please try again.");
        }
      } catch {
        // silently retry
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [generationId, status, router]);

  if (status === "COMPLETED" || status === "FAILED") return null;

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <div>
        <p className="font-medium">
          {status === "QUEUED" ? "Queued..." : "Generating your cover..."}
        </p>
        <p className="text-sm text-muted-foreground">
          This may take 15-30 seconds
        </p>
      </div>
    </div>
  );
}
