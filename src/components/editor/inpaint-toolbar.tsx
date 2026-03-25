"use client";

import { useState, useRef, useEffect } from "react";
import {
  Paintbrush,
  Eraser,
  Undo2,
  RotateCcw,
  RefreshCw,
  Sparkles,
  Images,
  X,
  Coins,
  Loader2,
  Lock,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { AI_MODELS, isModelAvailable } from "@/lib/constants";
import { useCreditStore } from "@/lib/stores/credit-store";
import type { CanvasNode } from "./canvas-types";

type ToolbarMode = "idle" | "brush" | "similar" | "bake" | "inpaint";

function buildBakeLayersPrompt(nodes: CanvasNode[]): string {
  const visible = nodes.filter((n) => n.visible);
  if (visible.length === 0) return "";
  const lines = visible.map((n) => {
    if (n.type === "text") return `${n.name ?? "Text"} text: "${n.text}"`;
    return `Image layer: "${n.name ?? n.id}"`;
  });
  return `Incorporate these elements into the cover image naturally:\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

interface InpaintToolbarProps {
  brushMode: boolean;
  setBrushMode: (v: boolean) => void;
  selectedImageUrl: string | undefined;
  brushSize: number;
  setBrushSize: (v: number) => void;
  erasing: boolean;
  setErasing: (v: boolean) => void;
  onBrushUndo: () => void;
  onBrushClear: () => void;
  onBrushDone: () => void;
  hasBrushMask: boolean;
  onRegenerate: () => void;
  activeGenerationCount: number;
  selectedImageId: string | null;
  inpaintMask: string | null;
  inpaintSubmitting: boolean;
  onInpaintSubmit: (prompt: string) => Promise<void>;
  onCancelInpaint: () => void;
  onRepaint: () => void;
  onGenerateSimilar: (prompt: string, includeLayers: boolean) => Promise<void>;
  includeLayers: boolean;
  onIncludeLayersChange: (checked: boolean) => void;
  model: string;
  setModel: (v: string) => void;
  imageCount: number;
  setImageCount: (v: number) => void;
  tier: string;
  nodes: CanvasNode[];
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
  selectedImageId,
  inpaintMask,
  inpaintSubmitting,
  onInpaintSubmit,
  onCancelInpaint,
  onRepaint,
  onGenerateSimilar,
  includeLayers,
  onIncludeLayersChange,
  model,
  setModel,
  imageCount,
  setImageCount,
  tier,
  nodes,
}: InpaintToolbarProps) {
  const creditBalance = useCreditStore((s) => s.balance);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarPrompt, setSimilarPrompt] = useState("");
  const [similarSubmitting, setSimilarSubmitting] = useState(false);
  const [inpaintPrompt, setInpaintPrompt] = useState("");
  const [bakeOpen, setBakeOpen] = useState(false);
  const [bakePrompt, setBakePrompt] = useState("");
  const [bakeSubmitting, setBakeSubmitting] = useState(false);

  const hasVisibleLayers = nodes.some((n) => n.visible);

  const mode: ToolbarMode =
    inpaintMask ? "inpaint" :
      brushMode ? "brush" :
        similarOpen ? "similar" :
          bakeOpen ? "bake" :
            "idle";

  const perImageCost = AI_MODELS.find((m) => m.value === model)?.creditCost ?? 5;
  const creditCost = mode === "inpaint" ? perImageCost : perImageCost * imageCount;
  const insufficientCredits = creditBalance < creditCost;

  // Reset on image change
  useEffect(() => {
    setSimilarOpen(false);
    setSimilarPrompt("");
    setBakeOpen(false);
    setBakePrompt("");
  }, [selectedImageId]);

  // Clear local prompt state when returning to idle
  useEffect(() => {
    if (mode === "idle") {
      setInpaintPrompt("");
    }
  }, [mode]);

  function handleCancelSimilar() {
    setSimilarOpen(false);
    setSimilarPrompt("");
  }

  function handleOpenBake() {
    setBakePrompt(buildBakeLayersPrompt(nodes));
    setBakeOpen(true);
  }

  function handleCancelBake() {
    setBakeOpen(false);
    setBakePrompt("");
  }

  async function handleSubmitBake() {
    setBakeSubmitting(true);
    try {
      await onGenerateSimilar(bakePrompt, true);
      setBakeOpen(false);
      setBakePrompt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBakeSubmitting(false);
    }
  }

  async function handleSubmitSimilar() {
    setSimilarSubmitting(true);
    try {
      await onGenerateSimilar(similarPrompt, false);
      setSimilarOpen(false);
      setSimilarPrompt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSimilarSubmitting(false);
    }
  }

  async function handleSubmitInpaint() {
    await onInpaintSubmit(inpaintPrompt);
  }

  function handleCancelInpaint() {
    setInpaintPrompt("");
    onCancelInpaint();
  }

  // ── Shared sub-components ──────────────────────────────────

  const modelSelector = (
    <Select value={model} onValueChange={(v) => v && setModel(v)}>
      <SelectTrigger className="h-7 w-[130px] text-xs">
        <SelectValue>
          {AI_MODELS.find((m) => m.value === model)?.label ?? "Model"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="min-w-52">
        {AI_MODELS.map((m) => {
          const locked = !isModelAvailable(m.value, tier);
          return (
            <SelectItem key={m.value} value={m.value} disabled={locked}>
              <HoverCard>
                <HoverCardTrigger
                  render={<span />}
                  className="underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 cursor-help"
                >
                  {locked && <Lock className="mr-1 inline size-3 text-muted-foreground" />}
                  {m.label}
                </HoverCardTrigger>
                <HoverCardContent side="right" className="text-sm">
                  {locked ? "Upgrade to Starter to unlock" : m.description}
                </HoverCardContent>
              </HoverCard>{" "}
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                <Coins className="size-2.5 text-yellow-500" />
                {m.creditCost}/img
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  const imageCountSlider = (
    <div className="flex items-center gap-1.5" title="Images per generation">
      <span className="text-[10px] text-muted-foreground w-3 text-right tabular-nums">{imageCount}</span>
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
    </div>
  );

  function renderCostBadge(compact?: boolean) {
    return (
      <span className={`inline-flex items-center gap-0.5 tabular-nums text-[10px] font-medium ${insufficientCredits ? "text-destructive" : compact ? "" : "text-muted-foreground"}`}>
        <Coins className={`text-yellow-500 ${compact ? "size-2.5" : "size-3"}`} />{creditCost}
      </span>
    );
  }

  function renderPopoverBody(popoverMode: "similar" | "inpaint" | "bake") {
    const isSimilar = popoverMode === "similar";
    const isBake = popoverMode === "bake";
    const prompt = isBake ? bakePrompt : isSimilar ? similarPrompt : inpaintPrompt;
    const setPrompt = isBake ? setBakePrompt : isSimilar ? setSimilarPrompt : setInpaintPrompt;

    return (
      <div
        className="space-y-2.5"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (isBake) handleSubmitBake();
            else if (isSimilar) handleSubmitSimilar();
            else handleSubmitInpaint();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            if (isBake) handleCancelBake();
            else if (isSimilar) handleCancelSimilar();
            else handleCancelInpaint();
          }
        }}
      >
        <div className="space-y-1">
          <Label className="text-xs">
            {isBake ? "Instructions" : isSimilar ? "Additional instructions" : "Describe the replacement"}
            {isSimilar && (
              <span className="font-normal text-muted-foreground"> (optional)</span>
            )}
          </Label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              isBake
                ? "Describe how to incorporate the layers..."
                : isSimilar
                  ? "e.g. More dramatic, warmer tones..."
                  : "e.g. Replace with a starry sky..."
            }
            rows={2}
            autoFocus={!isSimilar}
            className="flex w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        {popoverMode === "inpaint" && (
          <div className="flex items-center justify-between">
            <Label htmlFor={`include-layers-${popoverMode}`} className="text-xs">
              Include canvas layers
            </Label>
            <Switch
              id={`include-layers-${popoverMode}`}
              checked={includeLayers}
              onCheckedChange={onIncludeLayersChange}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <>
      <div ref={toolbarRef} className="rounded-lg border bg-popover shadow-md overflow-hidden">
        <div key={mode} className="flex items-center gap-1 px-1.5 py-1 animate-in fade-in-0 duration-150">
          {/* ── Idle mode ─────────────────────────── */}
          {mode === "idle" && (
            <>
              {/* Split Generate button */}
              <div className="flex">
                <Button
                  size="sm"
                  className="h-7 gap-1.5 rounded-r-none border-r-0 text-xs"
                  onClick={onRegenerate}
                  disabled={insufficientCredits}
                  title={insufficientCredits ? `Not enough credits (need ${creditCost}, have ${creditBalance})` : `${creditCost} credits`}
                >
                  <RefreshCw className="size-3.5" />
                  Generate
                  {activeGenerationCount > 0 && (
                    <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                      {activeGenerationCount}
                    </span>
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 rounded-l-none border-l border-primary-foreground/20 px-1.5 text-xs"
                        disabled={insufficientCredits}
                      />
                    }
                  >
                    <ChevronDown className="size-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" sideOffset={8} align="start">
                    <DropdownMenuItem
                      onClick={() => setSimilarOpen(true)}
                      disabled={!selectedImageId}
                    >
                      <Sparkles className="mr-2 size-3.5" />
                      Similar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Bake Layers — only when visible layers exist */}
              {hasVisibleLayers && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleOpenBake}
                  disabled={!selectedImageId || insufficientCredits}
                >
                  <Layers className="size-3.5" />
                  Bake Layers
                </Button>
              )}

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
              {modelSelector}
              {imageCountSlider}
              <div className="mx-1 h-5 w-px bg-border" />
              {renderCostBadge()}
            </>
          )}

          {/* ── Brush mode ────────────────────────── */}
          {mode === "brush" && (
            <>
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
            </>
          )}

          {/* ── Similar mode ──────────────────────── */}
          {mode === "similar" && (
            <>
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleSubmitSimilar}
                disabled={similarSubmitting || insufficientCredits}
              >
                {similarSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Generate Similar · {renderCostBadge(true)}
              </Button>
              <div className="mx-1 h-5 w-px bg-border" />
              {modelSelector}
              {imageCountSlider}
              <div className="mx-1 h-5 w-px bg-border" />
              <button
                onClick={handleCancelSimilar}
                className="p-1 text-muted-foreground hover:text-foreground"
                title="Cancel (Esc)"
              >
                <X className="size-3.5" />
              </button>
            </>
          )}

          {/* ── Bake mode ──────────────────────────── */}
          {mode === "bake" && (
            <>
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleSubmitBake}
                disabled={bakeSubmitting || insufficientCredits}
              >
                {bakeSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Layers className="size-3.5" />
                )}
                Bake Layers · {renderCostBadge(true)}
              </Button>
              <div className="mx-1 h-5 w-px bg-border" />
              {modelSelector}
              {imageCountSlider}
              <div className="mx-1 h-5 w-px bg-border" />
              <button
                onClick={handleCancelBake}
                className="p-1 text-muted-foreground hover:text-foreground"
                title="Cancel (Esc)"
              >
                <X className="size-3.5" />
              </button>
            </>
          )}

          {/* ── Inpaint mode ──────────────────────── */}
          {mode === "inpaint" && (
            <>
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleSubmitInpaint}
                disabled={inpaintSubmitting || !inpaintPrompt.trim() || insufficientCredits}
              >
                {inpaintSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Apply · {renderCostBadge(true)}
              </Button>
              <div className="mx-1 h-5 w-px bg-border" />
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={onRepaint}
              >
                <Paintbrush className="size-3.5" />
                Re-paint
              </Button>
              {modelSelector}
              <div className="mx-1 h-5 w-px bg-border" />
              <button
                onClick={handleCancelInpaint}
                className="p-1 text-muted-foreground hover:text-foreground"
                title="Cancel (Esc)"
              >
                <X className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Similar popover ─────────────────────── */}
      <PopoverPrimitive.Root open={mode === "similar"}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner className="isolate z-50" anchor={toolbarRef} side="top" sideOffset={8} align="center">
            <PopoverPrimitive.Popup className="z-50 w-72 rounded-lg border bg-popover p-3 shadow-md">
              {renderPopoverBody("similar")}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {/* ── Inpaint popover (no outside-click dismiss) ── */}
      <PopoverPrimitive.Root open={mode === "inpaint"}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner className="isolate z-50" anchor={toolbarRef} side="top" sideOffset={8} align="center">
            <PopoverPrimitive.Popup className="z-50 w-72 rounded-lg border bg-popover p-3 shadow-md">
              {renderPopoverBody("inpaint")}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {/* ── Bake Layers popover ────────────── */}
      <PopoverPrimitive.Root open={mode === "bake"}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner className="isolate z-50" anchor={toolbarRef} side="top" sideOffset={8} align="center">
            <PopoverPrimitive.Popup className="z-50 w-72 rounded-lg border bg-popover p-3 shadow-md">
              {renderPopoverBody("bake")}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
