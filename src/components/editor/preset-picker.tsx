"use client";

import type React from "react";
import { useState } from "react";
import { Check, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  computeAttributeDiff,
  type AttributeSelection,
  type Attribute,
} from "@/lib/attributes";

export interface StylePreset {
  id: string;
  name: string;
  attributes: AttributeSelection;
}

interface PresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: StylePreset[];
  activePresetId: string | null;
  currentAttributes: AttributeSelection;
  attributes: Attribute[];
  onSavePreset: (name: string) => void;
  onApplyPreset: (preset: StylePreset) => void;
}

export function PresetDialog({
  open,
  onOpenChange,
  presets,
  activePresetId,
  currentAttributes,
  attributes,
  onSavePreset,
  onApplyPreset,
}: PresetDialogProps) {
  const [presetName, setPresetName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleSave() {
    if (!presetName.trim()) return;
    onSavePreset(presetName.trim());
    setPresetName("");
  }

  function handleApply(preset: StylePreset) {
    onApplyPreset(preset);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Style Presets</DialogTitle>
        </DialogHeader>

        {/* Preset list */}
        {presets.length > 0 ? (
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {presets.map((preset) => {
              const isActive = preset.id === activePresetId;
              const isExpanded = preset.id === expandedId;
              return (
                <div key={preset.id}>
                  <button
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted ${isExpanded ? "bg-muted" : ""}`}
                    onClick={() => setExpandedId(isExpanded ? null : preset.id)}
                  >
                    {isActive ? (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{preset.name}</span>
                  </button>
                  {isExpanded && (
                    <div className="ml-6 mt-1 mb-2">
                      <PresetPreview
                        current={currentAttributes}
                        preset={preset}
                        attributes={attributes}
                        onApply={() => handleApply(preset)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No presets saved yet
          </p>
        )}

        {/* Save section */}
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs text-muted-foreground">Save current attributes as preset</Label>
          <div className="flex gap-2">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g., Dark Sci-Fi Noir"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
            <Button
              size="sm"
              className="h-8 shrink-0"
              disabled={!presetName.trim()}
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PresetPreview({
  current,
  preset,
  attributes,
  onApply,
}: {
  current: AttributeSelection;
  preset: StylePreset;
  attributes: Attribute[];
  onApply: () => void;
}) {
  const rawDiffs = computeAttributeDiff(current, preset.attributes);

  const diffs = rawDiffs?.map((d) => {
    const attr = attributes.find((c) => c.id === d.key);
    const resolve = (v: string) =>
      attr?.values.find((cv) => cv.value === v)?.label ?? v;
    return {
      label: attr?.name ?? d.label,
      added: d.added.map(resolve),
      removed: d.removed.map(resolve),
      kept: d.kept.map(resolve),
    };
  });

  return (
    <div className="space-y-2">
      {diffs && diffs.length > 0 ? (
        <div className="space-y-1">
          {diffs.map((d) => (
            <div key={d.label} className="text-xs">
              <span className="font-medium text-muted-foreground">
                {d.label}:
              </span>{" "}
              {[
                ...d.added.map((v) => (
                  <span key={`a-${v}`} className="font-semibold text-primary">
                    {v}
                  </span>
                )),
                ...d.kept.map((v) => (
                  <span key={`k-${v}`} className="text-foreground">
                    {v}
                  </span>
                )),
                ...d.removed.map((v) => (
                  <span
                    key={`r-${v}`}
                    className="text-muted-foreground line-through"
                  >
                    {v}
                  </span>
                )),
              ].reduce<React.ReactNode[]>((acc, el, i) => {
                if (i > 0) acc.push(<span key={`sep-${i}`}>, </span>);
                acc.push(el);
                return acc;
              }, [])}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No changes — attributes already match
        </p>
      )}
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={onApply}
        disabled={!diffs || diffs.length === 0}
      >
        Apply Preset
      </Button>
    </div>
  );
}
