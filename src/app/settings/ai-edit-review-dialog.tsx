"use client";

import { useState, useMemo, useRef } from "react";
import { Check, Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { diffAttributeConfigs, applyConfigChanges, type ConfigChange } from "@/lib/attribute-diff";
import { AI_FILL_CREDIT_COST } from "@/lib/constants";
import type { AttributeConfigJson } from "@/lib/attributes";

interface AiEditReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  before: AttributeConfigJson | null;
  after: AttributeConfigJson | null;
  onApply: (config: AttributeConfigJson) => void;
  onRegenerate: () => void;
}

function formatChange(change: ConfigChange): string {
  switch (change.type) {
    case "add-attribute":
      return `Add attribute: ${change.attribute.name} (${change.attribute.type})`;
    case "remove-attribute":
      return `Remove attribute: ${change.attribute.name}`;
    case "modify-attribute":
      return `Change ${change.field} of ${change.attributeName}`;
    case "add-value":
      return `Add value "${change.value.label}" to ${change.attributeName}`;
    case "remove-value":
      return `Remove value "${change.value.label}" from ${change.attributeName}`;
    case "modify-value":
      return `Update value "${change.valueBefore.label}" in ${change.attributeName}`;
  }
}

function ChangeBadge({ type }: { type: ConfigChange["type"] }) {
  if (type === "add-attribute" || type === "add-value")
    return <Badge className="bg-emerald-500/10 text-emerald-500 text-xs">Add</Badge>;
  if (type === "remove-attribute" || type === "remove-value")
    return <Badge className="bg-red-500/10 text-red-500 text-xs">Remove</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-500 text-xs">Change</Badge>;
}

function DiffDetail({ change }: { change: ConfigChange }) {
  if (change.type === "modify-attribute") {
    return (
      <div className="text-xs text-muted-foreground mt-1">
        <span className="line-through">{change.before || "(empty)"}</span>
        {" → "}
        <span className="text-foreground">{change.after || "(empty)"}</span>
      </div>
    );
  }
  if (change.type === "modify-value") {
    const parts: string[] = [];
    if (change.valueBefore.label !== change.valueAfter.label)
      parts.push(`label: "${change.valueBefore.label}" → "${change.valueAfter.label}"`);
    if (change.valueBefore.description !== change.valueAfter.description)
      parts.push(`description updated`);
    if (JSON.stringify(change.valueBefore.colors) !== JSON.stringify(change.valueAfter.colors))
      parts.push(`colors updated`);
    return <div className="text-xs text-muted-foreground mt-1">{parts.join(", ")}</div>;
  }
  if (change.type === "add-attribute" && change.attribute.values.length > 0) {
    return (
      <div className="text-xs text-muted-foreground mt-1">
        Values: {change.attribute.values.map((v) => v.label).join(", ")}
      </div>
    );
  }
  if (change.type === "add-value" && change.value.description) {
    return <div className="text-xs text-muted-foreground mt-1">{change.value.description}</div>;
  }
  return null;
}

export function AiEditReviewDialog({
  open,
  onOpenChange,
  before,
  after,
  onApply,
  onRegenerate,
}: AiEditReviewDialogProps) {
  const changes = useMemo(
    () => (before && after ? diffAttributeConfigs(before, after) : []),
    [before, after],
  );

  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  // Reset selection when changes update (render-time reset like AiFillReviewDialog)
  const prevChangesRef = useRef(changes);
  if (prevChangesRef.current !== changes) {
    prevChangesRef.current = changes;
    setSelected(new Set(changes.map((_, i) => i)));
  }

  function toggleChange(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleApply() {
    if (!before) return;
    const result = applyConfigChanges(before, changes, selected);
    onApply(result);
    onOpenChange(false);
  }

  // Check if applying would result in 0 attributes
  const wouldBeEmpty = useMemo(() => {
    if (!before || selected.size === 0) return false;
    const result = applyConfigChanges(before, changes, selected);
    return result.attributes.length === 0;
  }, [before, changes, selected]);

  // Group changes by attribute for display
  const grouped = useMemo(() => {
    const groups = new Map<string, { label: string; indices: number[] }>();
    changes.forEach((c, i) => {
      let key: string;
      let label: string;
      if (c.type === "add-attribute") {
        key = `new:${c.attribute.id}`;
        label = c.attribute.name;
      } else if (c.type === "remove-attribute") {
        key = `remove:${c.attribute.id}`;
        label = c.attribute.name;
      } else {
        key = c.attributeId;
        label = c.attributeName;
      }
      const group = groups.get(key) ?? { label, indices: [] };
      group.indices.push(i);
      groups.set(key, group);
    });
    return groups;
  }, [changes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {changes.length === 0
              ? "No Changes Detected"
              : "Review AI Changes"}
          </DialogTitle>
        </DialogHeader>

        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The AI didn&apos;t suggest any changes. Try rephrasing your instruction.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {changes.length} change{changes.length !== 1 ? "s" : ""} suggested. Uncheck any you don&apos;t want.
            </p>
            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {[...grouped.entries()].map(([key, group]) => (
                <div key={key} className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-2">
                    {group.label}
                  </p>
                  {group.indices.map((i) => {
                    const change = changes[i];
                    const checked = selected.has(i);
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleChange(i)}
                      >
                        <button type="button" className="mt-0.5 shrink-0">
                          <div
                            className={`flex size-4 items-center justify-center rounded border transition-colors ${
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background"
                            }`}
                          >
                            {checked && <Check className="size-3" />}
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <ChangeBadge type={change.type} />
                            <span className="text-sm">{formatChange(change)}</span>
                          </div>
                          <DiffDetail change={change} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-1.5">
            <Coins className="size-3" />
            Regenerate
          </Button>
          {changes.length > 0 && (
            <Button
              size="sm"
              onClick={handleApply}
              disabled={selected.size === 0 || wouldBeEmpty}
            >
              Apply {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
