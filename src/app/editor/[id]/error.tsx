"use client";

import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";

export default function EditorError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h1 className="text-xl font-bold">Failed to load the editor</h1>
      <p className="text-muted-foreground">
        The project might not exist, or there was a connection error.
      </p>
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline", className: "gap-2" })}
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <Button onClick={reset} className="gap-2">
          <RotateCcw className="size-4" />
          Retry
        </Button>
      </div>
    </div>
  );
}
