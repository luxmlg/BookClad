"use client";

import { useState, useCallback } from "react";
import { Check, Pencil } from "lucide-react";
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
import type { Attribute, AttributeConfigJson } from "@/lib/attributes";
import type { AiFillSuggestion } from "@/lib/ai-fill";

interface AiFillReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: AiFillSuggestion[];
  attributeConfig: AttributeConfigJson;
  onApply: (selected: AiFillSuggestion[]) => void;
  onRegenerate: () => void;
}

// ── SuggestionEditor ──────────────────────────────────────────────

interface SuggestionEditorProps {
  suggestion: AiFillSuggestion;
  attribute: Attribute | null;
  onChange: (value: string | string[]) => void;
  onClose: () => void;
}

function mergeValues(
  attribute: Attribute | null,
  suggestion: AiFillSuggestion,
): { value: string; label: string }[] {
  const seen = new Set<string>();
  const result: { value: string; label: string }[] = [];

  for (const v of attribute?.values ?? []) {
    if (!seen.has(v.value)) {
      seen.add(v.value);
      result.push({ value: v.value, label: v.label });
    }
  }
  for (const nv of suggestion.newValues ?? []) {
    if (!seen.has(nv.value)) {
      seen.add(nv.value);
      result.push({ value: nv.value, label: nv.label });
    }
  }
  for (const nv of suggestion.newAttribute?.values ?? []) {
    if (!seen.has(nv.value)) {
      seen.add(nv.value);
      result.push({ value: nv.value, label: nv.label });
    }
  }

  return result;
}

function SuggestionEditor({
  suggestion,
  attribute,
  onChange,
  onClose,
}: SuggestionEditorProps): React.ReactElement {
  const type = suggestion.type ?? attribute?.type ?? "text";
  const value = suggestion.value;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  if (type === "text") {
    return (
      <div className="px-2 pb-2">
        <textarea
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          rows={3}
          value={typeof value === "string" ? value : value.join(", ")}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
    );
  }

  if (type === "single" || type === "palette") {
    const options = mergeValues(attribute, suggestion);
    return (
      <div className="px-2 pb-2">
        <select
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          value={typeof value === "string" ? value : value[0] ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "multi") {
    const options = mergeValues(attribute, suggestion);
    const selected = Array.isArray(value) ? value : [value];
    const selectedSet = new Set(selected);

    function toggleTag(tagValue: string): void {
      const next = selectedSet.has(tagValue)
        ? selected.filter((v) => v !== tagValue)
        : [...selected, tagValue];
      onChange(next);
    }

    return (
      <div className="flex flex-wrap gap-1 px-2 pb-2" onKeyDown={handleKeyDown}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleTag(opt.value)}
            className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
              selectedSet.has(opt.value)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (type === "scale") {
    const numValue = typeof value === "string" ? parseInt(value, 10) || 5 : 5;
    const scaleLabels =
      attribute?.scaleLabels ?? suggestion.newAttribute?.scaleLabels;

    return (
      <div className="space-y-1 px-2 pb-2" onKeyDown={handleKeyDown}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={10}
            value={numValue}
            onChange={(e) => onChange(e.target.value)}
            className="h-1.5 flex-1 cursor-pointer accent-primary"
            autoFocus
          />
          <span className="w-5 text-center text-xs font-medium text-foreground">
            {numValue}
          </span>
        </div>
        {scaleLabels && (
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{scaleLabels.min}</span>
            <span>{scaleLabels.max}</span>
          </div>
        )}
      </div>
    );
  }

  if (type === "toggle") {
    const isOn = value === "true";
    return (
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => onChange(isOn ? "false" : "true")}
          className={`rounded border px-3 py-1 text-xs transition-colors ${
            isOn
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          {isOn ? "On" : "Off"}
        </button>
      </div>
    );
  }

  if (type === "color") {
    const colorValue = typeof value === "string" ? value : "#6366f1";
    return (
      <div className="flex items-center gap-2 px-2 pb-2" onKeyDown={handleKeyDown}>
        <input
          type="color"
          value={colorValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-border"
        />
        <input
          type="text"
          value={colorValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
      </div>
    );
  }

  return <></>;
}

// ── SuggestionRow ─────────────────────────────────────────────────

interface SuggestionRowProps {
  suggestion: AiFillSuggestion;
  checked: boolean;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
}

function SuggestionRow({
  suggestion,
  checked,
  editing,
  onToggle,
  onEdit,
}: SuggestionRowProps): React.ReactElement {
  const newValueCount = suggestion.newValues?.length ?? 0;

  return (
    <div className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/50">
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggle}
        className="mt-0.5 shrink-0"
      >
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

      {/* Content — click to edit */}
      <button
        type="button"
        onClick={onEdit}
        className="group min-w-0 flex-1 text-left"
      >
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-medium text-foreground">
              {suggestion.name ?? suggestion.attributeId ?? "Unknown"}
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
            <Pencil
              className={`size-3 text-muted-foreground transition-opacity ${
                editing
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
            />
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
    </div>
  );
}

// ── AiFillReviewDialog ────────────────────────────────────────────

export function AiFillReviewDialog({
  open,
  onOpenChange,
  suggestions,
  attributeConfig,
  onApply,
  onRegenerate,
}: AiFillReviewDialogProps): React.ReactElement {
  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(suggestions.map((_, i) => String(i))),
  );
  const [editedSuggestions, setEditedSuggestions] =
    useState<AiFillSuggestion[]>(suggestions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Render-time state reset when suggestions change (not a useEffect)
  const [prevSuggestions, setPrevSuggestions] =
    useState<AiFillSuggestion[]>(suggestions);
  if (suggestions !== prevSuggestions) {
    setPrevSuggestions(suggestions);
    setSelected(new Set(suggestions.map((_, i) => String(i))));
    setEditedSuggestions(suggestions);
    setEditingIndex(null);
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
    const selectedSuggestions = editedSuggestions.filter((_, i) =>
      selected.has(String(i)),
    );
    onApply(selectedSuggestions);
    onOpenChange(false);
  }

  function handleEditValue(index: number, value: string | string[]): void {
    setEditedSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, value } : s)),
    );
  }

  function resolveAttribute(suggestion: AiFillSuggestion): Attribute | null {
    if (suggestion.attributeId) {
      return (
        attributeConfig.attributes.find(
          (a) => a.id === suggestion.attributeId,
        ) ?? null
      );
    }
    if (suggestion.newAttribute) {
      return {
        id: suggestion.newAttribute.name.toLowerCase().replace(/\s+/g, "-"),
        name: suggestion.newAttribute.name,
        type: suggestion.newAttribute.type,
        builtIn: false,
        enabled: true,
        description: suggestion.newAttribute.description,
        values: (suggestion.newAttribute.values ?? []).map((v) => ({
          ...v,
          builtIn: false,
        })),
        scaleLabels: suggestion.newAttribute.scaleLabels,
      };
    }
    return null;
  }

  const updatedSuggestions = editedSuggestions
    .map((s, i) => ({ suggestion: s, index: i }))
    .filter(({ suggestion }) => !suggestion.isNew);

  const newSuggestions = editedSuggestions
    .map((s, i) => ({ suggestion: s, index: i }))
    .filter(({ suggestion }) => suggestion.isNew);

  const selectedCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>Review AI Suggestions</DialogTitle>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {updatedSuggestions.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Updated attributes
              </p>
              <div className="space-y-0.5">
                {updatedSuggestions.map(({ suggestion, index }) => (
                  <div key={index}>
                    <SuggestionRow
                      suggestion={suggestion}
                      checked={selected.has(String(index))}
                      editing={editingIndex === index}
                      onToggle={() => handleToggle(index)}
                      onEdit={() =>
                        setEditingIndex(
                          editingIndex === index ? null : index,
                        )
                      }
                    />
                    {editingIndex === index && (
                      <SuggestionEditor
                        suggestion={suggestion}
                        attribute={resolveAttribute(suggestion)}
                        onChange={(value) => handleEditValue(index, value)}
                        onClose={() => setEditingIndex(null)}
                      />
                    )}
                  </div>
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
                  <div key={index}>
                    <SuggestionRow
                      suggestion={suggestion}
                      checked={selected.has(String(index))}
                      editing={editingIndex === index}
                      onToggle={() => handleToggle(index)}
                      onEdit={() =>
                        setEditingIndex(
                          editingIndex === index ? null : index,
                        )
                      }
                    />
                    {editingIndex === index && (
                      <SuggestionEditor
                        suggestion={suggestion}
                        attribute={resolveAttribute(suggestion)}
                        onChange={(value) => handleEditValue(index, value)}
                        onClose={() => setEditingIndex(null)}
                      />
                    )}
                  </div>
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
