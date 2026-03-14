"use client";

import { Loader2 } from "lucide-react";
import { GenerationPoller } from "./generation-poller";

interface GenerationQueueProps {
  activeGenerationIds: string[];
  onComplete: (generationId: string, status: "COMPLETED" | "FAILED") => void;
}

export function GenerationQueue({
  activeGenerationIds,
  onComplete,
}: GenerationQueueProps) {
  if (activeGenerationIds.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 text-muted-foreground/40" />
        No active generations
      </div>
    );
  }

  return (
    <div className="overflow-y-auto px-4 pb-3" style={{ maxHeight: 320 }}>
      <div className="space-y-1">
        {activeGenerationIds.map((id) => (
          <div
            key={id}
            className="rounded-lg border bg-muted/30 px-2"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 px-1">
              <span className="font-mono">{id.slice(0, 8)}...</span>
            </div>
            <GenerationPoller
              generationId={id}
              onComplete={onComplete}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
