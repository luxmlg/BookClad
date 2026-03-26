"use client";

import { useRef } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Sparkles, Loader2, AlertTriangle, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreditStore } from "@/lib/stores/credit-store";
import { editAttributeConfig } from "@/lib/api/ai-fill";
import { AI_FILL_CREDIT_COST, AI_FILL_PROMPT_MAX_LENGTH } from "@/lib/constants";
import { toast } from "sonner";
import type { AttributeConfigJson } from "@/lib/attributes";

interface AiEditPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  onResult: (before: AttributeConfigJson, after: AttributeConfigJson) => void;
}

export function AiEditPopover({
  open,
  onOpenChange,
  prompt,
  onPromptChange,
  loading,
  onLoadingChange,
  onResult,
}: AiEditPopoverProps): React.ReactElement {
  const anchorRef = useRef<HTMLDivElement>(null);
  const balance = useCreditStore((s) => s.balance);
  const hasEnoughCredits = balance >= AI_FILL_CREDIT_COST;

  async function handleGenerate(): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    onLoadingChange(true);
    try {
      const { before, after } = await editAttributeConfig(trimmed);
      onResult(before, after);
      onOpenChange(false);
      useCreditStore.getState().refreshCredits();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to edit attributes";
      toast.error(message);
    } finally {
      onLoadingChange(false);
    }
  }

  return (
    <>
      <div ref={anchorRef}>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => onOpenChange(!open)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin text-yellow-500" />
          ) : (
            <Sparkles className="size-4 text-yellow-500" />
          )}
          AI Edit
        </Button>
      </div>

      <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            anchor={anchorRef}
            side="bottom"
            sideOffset={4}
            align="end"
          >
            <PopoverPrimitive.Popup className="z-50 w-80 rounded-lg border bg-popover p-3 shadow-md text-xs space-y-2.5">
              <p className="font-medium text-sm">Edit attributes with AI</p>
              <p className="text-muted-foreground">
                Describe what to change — add, remove, or modify attributes and values.
              </p>

              {!hasEnoughCredits && (
                <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-destructive">
                  <AlertTriangle className="size-3 shrink-0" />
                  Insufficient credits.
                </div>
              )}

              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder='e.g. "Add a Lighting attribute with dramatic, soft, and neon values"'
                maxLength={AI_FILL_PROMPT_MAX_LENGTH}
                disabled={loading}
                autoFocus
                className="flex w-full resize-none overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
                }}
              />
              <p className="text-right text-muted-foreground">
                {prompt.length}/{AI_FILL_PROMPT_MAX_LENGTH}
              </p>

              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={handleGenerate}
                disabled={!prompt.trim() || loading || !hasEnoughCredits}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3" />
                    Generate Changes
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Coins className="size-3 text-yellow-500" />
                <span>1 credit</span>
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
