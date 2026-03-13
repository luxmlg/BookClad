"use client";

import {
  Paintbrush,
  Eraser,
  Loader2,
  Sparkles,
  Undo2,
  RotateCcw,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface InpaintToolbarProps {
  brushMode: boolean;
  setBrushMode: (v: boolean) => void;
  inpaintMask: string | null;
  setInpaintMask: (v: string | null) => void;
  inpaintPrompt: string;
  setInpaintPrompt: (v: string) => void;
  inpaintSubmitting: boolean;
  onInpaintSubmit: () => void;
  selectedImageUrl: string | undefined;
  // Brush controls
  brushSize: number;
  setBrushSize: (v: number) => void;
  erasing: boolean;
  setErasing: (v: boolean) => void;
  onBrushUndo: () => void;
  onBrushClear: () => void;
  onBrushDone: () => void;
  hasBrushMask: boolean;
  // Generate actions
  onRegenerate: () => void;
  pendingGeneration: boolean;
  onOpenSimilarDialog: () => void;
  selectedImageId: string | null;
}

export function InpaintToolbar({
  brushMode,
  setBrushMode,
  inpaintMask,
  setInpaintMask,
  inpaintPrompt,
  setInpaintPrompt,
  inpaintSubmitting,
  onInpaintSubmit,
  selectedImageUrl,
  brushSize,
  setBrushSize,
  erasing,
  setErasing,
  onBrushUndo,
  onBrushClear,
  onBrushDone,
  hasBrushMask,
  onRegenerate,
  pendingGeneration,
  onOpenSimilarDialog,
  selectedImageId,
}: InpaintToolbarProps) {
  // Painting phase — show brush controls
  if (brushMode && !inpaintMask) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-popover px-2 py-1 shadow-md">
        <Button
          variant={!erasing ? "default" : "outline"}
          size="icon-sm"
          onClick={() => setErasing(false)}
          title="Paint (select region)"
        >
          <Paintbrush className="size-3" />
        </Button>
        <Button
          variant={erasing ? "default" : "outline"}
          size="icon-sm"
          onClick={() => setErasing(true)}
          title="Erase (deselect region)"
        >
          <Eraser className="size-3" />
        </Button>
        <div className="flex items-center w-24">
          <Slider
            value={[brushSize]}
            onValueChange={(v) => setBrushSize(Array.isArray(v) ? v[0] : v)}
            min={5}
            max={80}
            step={1}
          />
        </div>
        <span className="text-[10px] text-muted-foreground w-6 text-right">{brushSize}</span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onBrushUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="size-3" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onBrushClear}
          title="Clear all"
        >
          <RotateCcw className="size-3" />
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs px-2"
          onClick={onBrushDone}
          disabled={!hasBrushMask}
        >
          Done
        </Button>
        <button
          onClick={() => setBrushMode(false)}
          className="p-1 text-muted-foreground hover:text-foreground"
          title="Cancel"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  // Mask captured — show prompt input + actions
  if (brushMode && inpaintMask) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border bg-popover px-1.5 py-1 shadow-md">
        {/* Mask thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={inpaintMask}
          alt="Mask"
          className="shrink-0 rounded border object-cover"
          style={{ width: 24, height: 38 }}
        />

        {/* Prompt input */}
        <input
          type="text"
          value={inpaintPrompt}
          onChange={(e) => setInpaintPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !inpaintSubmitting && inpaintPrompt.trim()) {
              onInpaintSubmit();
            }
          }}
          placeholder="Describe the replacement..."
          className="h-7 flex-1 min-w-[180px] rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />

        {/* Re-paint */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => setInpaintMask(null)}
        >
          Re-paint
        </Button>

        {/* Apply Edit */}
        <Button
          size="sm"
          className="h-7 text-xs px-2 gap-1"
          onClick={onInpaintSubmit}
          disabled={inpaintSubmitting || !inpaintPrompt.trim()}
        >
          {inpaintSubmitting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          Apply
        </Button>

        {/* Cancel */}
        <button
          onClick={() => {
            setBrushMode(false);
            setInpaintMask(null);
            setInpaintPrompt("");
          }}
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  // Idle — show Generate + Edit Region buttons
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-popover px-1.5 py-1 shadow-md">
      <Button
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={onRegenerate}
        disabled={pendingGeneration}
      >
        {pendingGeneration ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Generate Covers
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={onOpenSimilarDialog}
        disabled={!selectedImageId}
      >
        <Sparkles className="size-3.5" />
        Generate Similar
      </Button>
      <div className="mx-1 h-5 w-px bg-border" />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setBrushMode(true)}
        disabled={!selectedImageUrl}
      >
        <Paintbrush className="size-3.5" />
        Edit Region
      </Button>
    </div>
  );
}
