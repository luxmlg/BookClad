"use client";

import { useRef } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Sparkles, Loader2, AlertTriangle, Coins } from "lucide-react";
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
          size="sm"
          onClick={() => onOpenChange(!open)}
          disabled={loading}
          className="w-full gap-1.5 bg-background text-xs text-yellow-500 hover:bg-accent hover:text-yellow-400 border border-input"
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
            <PopoverPrimitive.Popup className="z-50 w-72 rounded-lg border bg-popover p-3 shadow-md text-xs space-y-2.5">
              <p className="font-medium">Describe what you want</p>
              <p className="text-muted-foreground">
                AI will suggest attribute updates based on your description.
              </p>

              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="e.g. Make it darker and more mysterious, like a gothic thriller..."
                maxLength={MAX_PROMPT_LENGTH}
                disabled={loading}
                autoFocus
                className="flex w-full resize-none overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              />
              <p className="text-right text-muted-foreground">
                {prompt.length}/{MAX_PROMPT_LENGTH}
              </p>

              {!hasEnoughCredits && (
                <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-destructive">
                  <AlertTriangle className="size-3 shrink-0" />
                  Insufficient credits.
                </div>
              )}

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
                    Generate
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
