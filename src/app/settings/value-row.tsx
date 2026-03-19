"use client";

import { useState } from "react";
import { Trash2Icon, ChevronRightIcon, RotateCcwIcon, PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getDefaultDescription,
  type AttributeValue,
} from "@/lib/attributes";

interface ValueRowProps {
  attributeId: string;
  value: AttributeValue;
  onUpdateValue: (updates: Partial<Pick<AttributeValue, "description" | "disabled" | "colors">>) => void;
  onRemoveValue: () => void;
}

export function ValueRow({
  attributeId,
  value,
  onUpdateValue,
  onRemoveValue,
}: ValueRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(value.description ?? "");
  const [colorsDraft, setColorsDraft] = useState<string[]>(value.colors ?? []);

  const defaultDesc = value.builtIn
    ? getDefaultDescription(attributeId, value.value)
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

  function updateColor(index: number, color: string) {
    const next = colorsDraft.map((c, i) => (i === index ? color : c));
    setColorsDraft(next);
    onUpdateValue({ colors: next });
  }

  function addColor() {
    if (colorsDraft.length >= 6) return;
    const next = [...colorsDraft, "#888888"];
    setColorsDraft(next);
    onUpdateValue({ colors: next });
  }

  function removeColor(index: number) {
    if (colorsDraft.length <= 3) return;
    const next = colorsDraft.filter((_, i) => i !== index);
    setColorsDraft(next);
    onUpdateValue({ colors: next });
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
          {value.colors && value.colors.length > 0 && (
            <span className="flex shrink-0 items-center gap-0.5">
              {value.colors.map((color, i) => (
                <span
                  key={i}
                  className="size-3 rounded-full border border-border/50"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
          )}
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
          {colorsDraft.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {colorsDraft.map((color, i) => (
                <div key={i} className="group/color relative">
                  <label
                    className="block size-6 cursor-pointer rounded-full border border-border shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => updateColor(i, e.target.value)}
                      className="sr-only"
                    />
                  </label>
                  {colorsDraft.length > 3 && (
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 hidden size-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover/color:flex"
                      onClick={() => removeColor(i)}
                    >
                      <XIcon className="size-2" />
                    </button>
                  )}
                </div>
              ))}
              {colorsDraft.length < 6 && (
                <button
                  type="button"
                  className="flex size-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground"
                  onClick={addColor}
                >
                  <PlusIcon className="size-3" />
                </button>
              )}
            </div>
          )}
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
