"use client";

import type React from "react";
import { useRef, useState } from "react";
import { BookmarkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectWithAction } from "@/components/ui/select-with-action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
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

interface PresetPickerProps {
  presets: StylePreset[];
  activePresetId: string | null;
  currentAttributes: AttributeSelection;
  attributes: Attribute[];
  onSavePreset: (name: string) => void;
  onApplyPreset: (preset: StylePreset) => void;
}

export function PresetPicker({
  presets,
  activePresetId,
  currentAttributes,
  attributes,
  onSavePreset,
  onApplyPreset,
}: PresetPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [previewPreset, setPreviewPreset] = useState<StylePreset | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div className="space-y-2">
        <Label>Style Preset</Label>
        <div ref={anchorRef}>
          <SelectWithAction
            icon={<BookmarkIcon className="size-3.5" />}
            onClick={() => setDialogOpen(true)}
            title="Save current attributes as preset"
          >
            <Select
              value={previewPreset?.id ?? activePresetId ?? null}
              onValueChange={(v) => {
                if (!v) return;
                const preset = presets.find((p) => p.id === v);
                if (preset) setPreviewPreset(preset);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Apply a preset...">
                  {(value: string | null) => {
                    if (!value) return "Apply a preset...";
                    return presets.find((p) => p.id === value)?.name ?? value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SelectWithAction>
        </div>
      </div>

      {/* Floating preview popover */}
      <PopoverPrimitive.Root
        open={!!previewPreset}
        onOpenChange={(open) => {
          if (!open) setPreviewPreset(null);
        }}
      >
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            anchor={anchorRef}
            side="right"
            sideOffset={8}
            align="start"
          >
            <PopoverPrimitive.Popup className="z-50 w-64 rounded-lg border bg-popover p-3 shadow-md">
              {previewPreset && (
                <PresetPreview
                  current={currentAttributes}
                  preset={previewPreset}
                  attributes={attributes}
                  onApply={() => {
                    onApplyPreset(previewPreset);
                    setPreviewPreset(null);
                  }}
                  onCancel={() => setPreviewPreset(null)}
                />
              )}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {/* Save Preset Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Style Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Preset Name</Label>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g., Dark Sci-Fi Noir"
              onKeyDown={(e) => {
                if (e.key === "Enter" && presetName.trim()) {
                  onSavePreset(presetName.trim());
                  setPresetName("");
                  setDialogOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!presetName.trim()}
              onClick={() => {
                onSavePreset(presetName.trim());
                setPresetName("");
                setDialogOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PresetPreview({
  current,
  preset,
  attributes,
  onApply,
  onCancel,
}: {
  current: AttributeSelection;
  preset: StylePreset;
  attributes: Attribute[];
  onApply: () => void;
  onCancel: () => void;
}) {
  // Use shared diff logic, then resolve value slugs to display labels
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
    <div className="space-y-3">
      {diffs && diffs.length > 0 ? (
        <div className="space-y-1.5">
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
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={onApply}
          disabled={!diffs || diffs.length === 0}
        >
          Apply Preset
        </Button>
      </div>
    </div>
  );
}
