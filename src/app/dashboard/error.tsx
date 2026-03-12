"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="container mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h1 className="text-xl font-bold">Failed to load your projects</h1>
      <p className="text-muted-foreground">
        Please check your connection and try again.
      </p>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RotateCcw className="size-4" />
        Retry
      </Button>
    </div>
  );
}
