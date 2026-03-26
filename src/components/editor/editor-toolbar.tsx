"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Images,
  X,
  Coins,
  Loader2,
  Lock,
  Layers,
} from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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

type ToolbarMode = "idle" | "similar" | "bake";
type BakeStyle = "stylized" | "clean";

function buildBakeLayersPrompt(style: BakeStyle): string {
  const common = "Text has been placed onto this cover image. Ensure all text is clearly legible with strong contrast against the background. Keep text well away from the image edges — at least 10% margin from all borders. Do not change the underlying artwork — only enhance the text regions.";
  if (style === "stylized") {
    return `${common} Integrate the text into the artwork with creative, genre-appropriate effects — embossing, glow, texture, shadows. Make the typography look like a professionally designed cover.`;
  }
  return `${common} Blend the text cleanly into the composition — add subtle shadows or contrast adjustments for legibility. Do not apply decorative effects.`;
}

interface EditorToolbarProps {
  onRegenerate: () => void;
  activeGenerationCount: number;
  selectedImageId: string | null;
  onGenerateSimilar: (prompt: string, includeLayers: boolean) => Promise<void>;
  model: string;
  setModel: (v: string) => void;
  imageCount: number;
  setImageCount: (v: number) => void;
  tier: string;
  nodes: CanvasNode[];
}

export function EditorToolbar({
  onRegenerate,
  activeGenerationCount,
  selectedImageId,
  onGenerateSimilar,
  model,
  setModel,
  imageCount,
  setImageCount,
  tier,
  nodes,
}: EditorToolbarProps) {
  const creditBalance = useCreditStore((s) => s.balance);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarPrompt, setSimilarPrompt] = useState("");
  const [similarSubmitting, setSimilarSubmitting] = useState(false);
  const [bakeOpen, setBakeOpen] = useState(false);
  const [bakePrompt, setBakePrompt] = useState("");
  const [bakeStyle, setBakeStyle] = useState<BakeStyle | null>("stylized");
  const [bakeSubmitting, setBakeSubmitting] = useState(false);

  const hasVisibleLayers = nodes.some((n) => n.visible);

  const mode: ToolbarMode = similarOpen ? "similar" : bakeOpen ? "bake" : "idle";

  const perImageCost = AI_MODELS.find((m) => m.value === model)?.creditCost ?? 5;
  const creditCost = perImageCost * imageCount;
  const insufficientCredits = creditBalance < creditCost;

  // Reset on image change
  useEffect(() => {
    setSimilarOpen(false);
    setSimilarPrompt("");
    setBakeOpen(false);
    setBakePrompt("");
  }, [selectedImageId]);

  function handleCancelSimilar() {
    setSimilarOpen(false);
    setSimilarPrompt("");
  }

  function handleOpenBake() {
    const style: BakeStyle = bakeStyle ?? "stylized";
    setBakeStyle(style);
    setBakePrompt(buildBakeLayersPrompt(style));
    setBakeOpen(true);
  }

  function handleCancelBake() {
    setBakeOpen(false);
    setBakePrompt("");
  }

  function handleBakeStyleChange(style: BakeStyle) {
    setBakeStyle(style);
    setBakePrompt(buildBakeLayersPrompt(style));
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

  function renderPopoverBody(popoverMode: "similar" | "bake") {
    const isSimilar = popoverMode === "similar";
    const isBake = popoverMode === "bake";
    const prompt = isBake ? bakePrompt : similarPrompt;
    const setPrompt = isBake ? setBakePrompt : setSimilarPrompt;

    return (
      <div
        className="space-y-2.5"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (isBake) handleSubmitBake();
            else handleSubmitSimilar();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            if (isBake) handleCancelBake();
            else handleCancelSimilar();
          }
        }}
      >
        {isBake && (
          <div className="space-y-1">
            <Label className="text-xs">Text style</Label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleBakeStyleChange("stylized")}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  bakeStyle === "stylized"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Stylized
              </button>
              <button
                type="button"
                onClick={() => handleBakeStyleChange("clean")}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  bakeStyle === "clean"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Clean
              </button>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">
            {isBake ? "Instructions" : "Additional instructions"}
            {isSimilar && (
              <span className="font-normal text-muted-foreground"> (optional)</span>
            )}
          </Label>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (isBake) setBakeStyle(null);
            }}
            placeholder={
              isBake
                ? "Describe how to incorporate the layers..."
                : "e.g. More dramatic, warmer tones..."
            }
            rows={4}
            autoFocus={!isSimilar}
            className="flex w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
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
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={onRegenerate}
                disabled={activeGenerationCount > 0}
              >
                <Sparkles className="size-3.5" />
                Generate
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setSimilarOpen(true)}
                disabled={!selectedImageId}
              >
                <Sparkles className="size-3.5" />
                Similar
              </Button>

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
              {modelSelector}
              {imageCountSlider}
              <div className="mx-1 h-5 w-px bg-border" />
              {renderCostBadge()}
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
        </div>
      </div>

      {/* ── Similar popover ─────────────────────── */}
      <PopoverPrimitive.Root open={mode === "similar"}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner className="isolate z-50" anchor={toolbarRef} side="top" sideOffset={8} align="center">
            <PopoverPrimitive.Popup className="z-50 w-80 rounded-lg border bg-popover p-3 shadow-md">
              {renderPopoverBody("similar")}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {/* ── Bake Layers popover ────────────── */}
      <PopoverPrimitive.Root open={mode === "bake"}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner className="isolate z-50" anchor={toolbarRef} side="top" sideOffset={8} align="center">
            <PopoverPrimitive.Popup className="z-50 w-80 rounded-lg border bg-popover p-3 shadow-md">
              {renderPopoverBody("bake")}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
