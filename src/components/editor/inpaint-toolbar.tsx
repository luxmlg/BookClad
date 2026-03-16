"use client";

import {
  Paintbrush,
  Eraser,
  Undo2,
  RotateCcw,
  RefreshCw,
  Sparkles,
  Images,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AI_MODELS } from "@/lib/constants";

interface InpaintToolbarProps {
  brushMode: boolean;
  setBrushMode: (v: boolean) => void;
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
  activeGenerationCount: number;
  onOpenSimilarDialog: () => void;
  selectedImageId: string | null;
  // Generation settings
  model: string;
  setModel: (v: string) => void;
  imageCount: number;
  setImageCount: (v: number) => void;
  // Credits
  creditBalance: number;
  creditCost: number;
}

export function InpaintToolbar({
  brushMode,
  setBrushMode,
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
  activeGenerationCount,
  onOpenSimilarDialog,
  selectedImageId,
  model,
  setModel,
  imageCount,
  setImageCount,
  creditBalance,
  creditCost,
}: InpaintToolbarProps) {
  const insufficientCredits = creditBalance < creditCost;
  // Painting phase — show brush controls
  if (brushMode) {
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

  // Idle — show Generate + Edit Region buttons
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-popover px-1.5 py-1 shadow-md">
      <Button
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={onRegenerate}
        disabled={insufficientCredits}
        title={insufficientCredits ? `Not enough credits (need ${creditCost}, have ${creditBalance})` : `${creditCost} credits`}
      >
        <RefreshCw className="size-3.5" />
        Generate
        <span className="text-[10px] opacity-70">{creditCost}cr</span>
        {activeGenerationCount > 0 && (
          <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-bold">
            {activeGenerationCount}
          </span>
        )}
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
      <div className="mx-1 h-5 w-px bg-border" />
      <Select value={model} onValueChange={(v) => v && setModel(v)}>
        <SelectTrigger className="h-7 w-[130px] text-xs">
          <SelectValue>
            {AI_MODELS.find((m) => m.value === model)?.label ?? "Model"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="min-w-52">
          {AI_MODELS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label} <span className="text-muted-foreground">({m.creditCost}cr/img)</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5" title="Images per generation">
        <Images className="size-3.5 text-muted-foreground" />
        <div className="w-16">
          <Slider
            value={[imageCount]}
            onValueChange={(v) => setImageCount(Array.isArray(v) ? v[0] : v)}
            min={1}
            max={8}
            step={1}
          />
        </div>
        <span className="text-[10px] text-muted-foreground w-3 text-right">{imageCount}</span>
      </div>
      <div className="mx-1 h-5 w-px bg-border" />
      <span className={`text-[10px] font-medium ${insufficientCredits ? "text-destructive" : "text-muted-foreground"}`}>
        {creditBalance}cr
      </span>
    </div>
  );
}
