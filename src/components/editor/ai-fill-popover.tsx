"use client";

import { useRef } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreditStore } from "@/lib/stores/credit-store";
import { generateAttributes } from "@/lib/api/ai-fill";
import type { AiFillSuggestion } from "@/lib/ai-fill";
import { toast } from "sonner";

const MAX_PROMPT_LENGTH = 500;
const AI_FILL_CREDIT_COST = 1;

interface AiFillPopoverProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  onSuggestions: (suggestions: AiFillSuggestion[]) => void;
}

export function AiFillPopover({
  projectId,
  open,
  onOpenChange,
  prompt,
  onPromptChange,
  loading,
  onLoadingChange,
  onSuggestions,
}: AiFillPopoverProps): React.ReactElement {
  const anchorRef = useRef<HTMLDivElement>(null);
  const balance = useCreditStore((s) => s.balance);
  const hasEnoughCredits = balance >= AI_FILL_CREDIT_COST;

  async function handleGenerate(): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    onLoadingChange(true);
    try {
      const suggestions = await generateAttributes(projectId, trimmed);
      onSuggestions(suggestions);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate suggestions";
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
          size="sm"
          onClick={() => onOpenChange(!open)}
          disabled={loading}
          className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950 dark:hover:text-purple-300"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          AI Fill
        </Button>
      </div>

      <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            anchor={anchorRef}
            side="bottom"
            sideOffset={4}
            align="start"
          >
            <PopoverPrimitive.Popup className="z-50 w-80 rounded-lg border bg-popover p-3 shadow-md">
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Describe what you want
                  </p>
                  <p className="text-xs text-muted-foreground">
                    AI will suggest attribute updates based on your description.
                  </p>
                </div>

                <div className="space-y-1">
                  <textarea
                    rows={3}
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder="e.g. Make it darker and more mysterious, like a gothic thriller..."
                    maxLength={MAX_PROMPT_LENGTH}
                    disabled={loading}
                    autoFocus
                    className="flex w-full resize-none overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {prompt.length}/{MAX_PROMPT_LENGTH}
                  </p>
                </div>

                {!hasEnoughCredits && (
                  <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    Insufficient credits to use AI Fill.
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full gap-1.5 bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || loading || !hasEnoughCredits}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
