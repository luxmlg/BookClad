"use client";

import { useState } from "react";
import { Trash2Icon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getDefaultDescription,
  type AttributeValue,
} from "@/lib/attributes";

interface ValueRowProps {
  categoryId: string;
  value: AttributeValue;
  onUpdateValue: (updates: Partial<Pick<AttributeValue, "description" | "disabled">>) => void;
  onRemoveValue: () => void;
}

export function ValueRow({
  categoryId,
  value,
  onUpdateValue,
  onRemoveValue,
}: ValueRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(value.description ?? "");

  const defaultDesc = value.builtIn
    ? getDefaultDescription(categoryId, value.value)
    : undefined;
  const canRestore =
    defaultDesc !== undefined && value.description !== defaultDesc;

  function handleBlur() {
    const trimmed = draft.trim();
    if (trimmed !== (value.description ?? "")) {
      onUpdateValue({ description: trimmed || undefined });
    }
  }

  function handleRestore() {
    if (defaultDesc !== undefined) {
      setDraft(defaultDesc);
      onUpdateValue({ description: defaultDesc });
    }
  }

  return (
    <div
      className={`rounded-md border text-sm${value.disabled ? " opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRightIcon
            className={`size-3 shrink-0 text-muted-foreground transition-transform${expanded ? " rotate-90" : ""}`}
          />
          <span className="truncate">{value.label}</span>
          {value.builtIn && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              built-in
            </Badge>
          )}
          {!expanded && value.description && (
            <span className="truncate text-xs text-muted-foreground">
              {value.description}
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {value.builtIn ? (
            <Switch
              checked={!value.disabled}
              onCheckedChange={(checked) =>
                onUpdateValue({ disabled: !checked })
              }
            />
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 text-muted-foreground hover:text-destructive"
              onClick={onRemoveValue}
            >
              <Trash2Icon className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 border-t px-3 py-2">
          <Textarea
            rows={2}
            placeholder="Add a description..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            className="text-xs"
          />
          {canRestore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={handleRestore}
            >
              <RotateCcwIcon className="size-3" />
              Restore default
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
