"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAttrValue } from "@/lib/attributes";
import type { AiFillSuggestion } from "@/lib/ai-fill";

interface AiFillReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: AiFillSuggestion[];
  onApply: (selected: AiFillSuggestion[]) => void;
  onRegenerate: () => void;
}

// ── SuggestionRow ─────────────────────────────────────────────────

interface SuggestionRowProps {
  suggestion: AiFillSuggestion;
  checked: boolean;
  onToggle: () => void;
}

function SuggestionRow({
  suggestion,
  checked,
  onToggle,
}: SuggestionRowProps): React.ReactElement {
  const newValueCount = suggestion.newValues?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
    >
      {/* Custom checkbox */}
      <div
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background"
        }`}
      >
        {checked && <Check className="size-3" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-medium text-foreground">
            {suggestion.name}
          </span>
          {suggestion.isNew && (
            <Badge variant="secondary" className="h-4 text-[10px]">
              NEW
            </Badge>
          )}
          {newValueCount > 0 && (
            <Badge variant="outline" className="h-4 text-[10px]">
              +{newValueCount} new
            </Badge>
          )}
        </div>

        <p className="text-xs text-foreground/80">
          {formatAttrValue(suggestion.value)}
        </p>

        {suggestion.previousValue !== undefined && (
          <p className="text-xs text-muted-foreground">
            was: {formatAttrValue(suggestion.previousValue)}
          </p>
        )}
      </div>
    </button>
  );
}

// ── AiFillReviewDialog ────────────────────────────────────────────

export function AiFillReviewDialog({
  open,
  onOpenChange,
  suggestions,
  onApply,
  onRegenerate,
}: AiFillReviewDialogProps): React.ReactElement {
  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(suggestions.map((_, i) => String(i))),
  );

  // Render-time state reset when suggestions change (not a useEffect)
  const [prevSuggestions, setPrevSuggestions] =
    useState<AiFillSuggestion[]>(suggestions);
  if (suggestions !== prevSuggestions) {
    setPrevSuggestions(suggestions);
    setSelected(new Set(suggestions.map((_, i) => String(i))));
  }

  function handleToggle(index: number): void {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = String(index);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleApply(): void {
    const selectedSuggestions = suggestions.filter((_, i) =>
      selected.has(String(i)),
    );
    onApply(selectedSuggestions);
    onOpenChange(false);
  }

  const updatedSuggestions = suggestions
    .map((s, i) => ({ suggestion: s, index: i }))
    .filter(({ suggestion }) => !suggestion.isNew);

  const newSuggestions = suggestions
    .map((s, i) => ({ suggestion: s, index: i }))
    .filter(({ suggestion }) => suggestion.isNew);

  const selectedCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>Review AI Suggestions</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {updatedSuggestions.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Updated attributes
              </p>
              <div className="space-y-0.5">
                {updatedSuggestions.map(({ suggestion, index }) => (
                  <SuggestionRow
                    key={index}
                    suggestion={suggestion}
                    checked={selected.has(String(index))}
                    onToggle={() => handleToggle(index)}
                  />
                ))}
              </div>
            </div>
          )}

          {newSuggestions.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                New attributes suggested
              </p>
              <div className="space-y-0.5">
                {newSuggestions.map(({ suggestion, index }) => (
                  <SuggestionRow
                    key={index}
                    suggestion={suggestion}
                    checked={selected.has(String(index))}
                    onToggle={() => handleToggle(index)}
                  />
                ))}
              </div>
            </div>
          )}

          {suggestions.length === 0 && (
            <p className="px-2 text-sm text-muted-foreground">
              No suggestions to review.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            Regenerate
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={selectedCount === 0}
          >
            Apply {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
