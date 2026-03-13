"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronRight, Sparkles, Copy, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AI_MODELS } from "@/lib/constants";

interface GeneratedImage {
  id: string;
  storageKey: string;
  width: number;
  height: number;
  selected: boolean;
}

type AttributeSnapshot = Record<string, string | string[]>;
type TextLayerSnapshot = Array<{ name: string; text: string }>;

interface Generation {
  id: string;
  status: string;
  createdAt: string | Date;
  imageCount?: number;
  jobType?: string;
  model?: string;
  prompt?: string;
  images: GeneratedImage[];
  parentImageId?: string | null;
  parentImage?: { id: string; storageKey: string } | null;
  attributeSnapshot?: unknown;
  textLayerSnapshot?: unknown;
}

function asAttributeSnapshot(val: unknown): AttributeSnapshot | null {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as AttributeSnapshot;
  }
  return null;
}

function asTextLayerSnapshot(val: unknown): TextLayerSnapshot | null {
  if (Array.isArray(val)) return val as TextLayerSnapshot;
  return null;
}

interface GenerationHistoryProps {
  generations: Generation[];
  imageUrls: Record<string, string>;
  selectedImageId: string | null;
  onSelect: (id: string) => void;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
}

export function GenerationHistory({
  generations,
  imageUrls,
  selectedImageId,
  onSelect,
  historyOpen,
  onHistoryOpenChange,
}: GenerationHistoryProps) {
  return (
    <Collapsible
      open={historyOpen}
      onOpenChange={onHistoryOpenChange}
      className="shrink-0 border-t bg-background/80"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
        <ChevronRight
          className={`size-3.5 transition-transform duration-200 ${historyOpen ? "rotate-90" : ""}`}
        />
        Generation History
        {generations.length > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
            {generations.length}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {generations.length > 0 && (
          <div
            className="overflow-y-auto px-4 pb-3"
            style={{ maxHeight: 320 }}
          >
            <div className="space-y-1">
              {generations.map((gen, idx) => (
                <GenerationGroup
                  key={gen.id}
                  generation={gen}
                  index={generations.length - idx}
                  imageUrls={imageUrls}
                  selectedImageId={selectedImageId}
                  onSelect={onSelect}
                  defaultOpen={idx === 0}
                  allGenerations={generations}
                  previousGeneration={
                    idx < generations.length - 1
                      ? generations[idx + 1]
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

const JOB_TYPE_ICON: Record<string, typeof Sparkles> = {
  generate: Sparkles,
  "generate-from-reference": Copy,
  inpaint: Wand2,
};

function getModelLabel(modelValue?: string) {
  if (!modelValue) return null;
  const found = AI_MODELS.find((m) => m.value === modelValue);
  return found ? found.label : modelValue;
}

function findParentGenerationIndex(
  parentImageId: string | null | undefined,
  allGenerations: Generation[]
) {
  if (!parentImageId) return null;
  for (let i = 0; i < allGenerations.length; i++) {
    if (allGenerations[i].images.some((img) => img.id === parentImageId)) {
      return allGenerations.length - i;
    }
  }
  return null;
}

function formatAttributes(
  snapshot: Record<string, string | string[]>
): string {
  return Object.entries(snapshot)
    .map(([key, val]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const value = Array.isArray(val) ? val.join(", ") : val;
      return `${label}: ${value}`;
    })
    .join(" · ");
}

interface AttributeDiff {
  key: string;
  label: string;
  added: string[];
  removed: string[];
  kept: string[];
}

function computeAttributeDiff(
  current: Record<string, string | string[]> | null | undefined,
  previous: Record<string, string | string[]> | null | undefined
): AttributeDiff[] | null {
  if (!current || !previous) return null;

  const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const diffs: AttributeDiff[] = [];

  for (const key of allKeys) {
    const curVal = current[key];
    const prevVal = previous[key];
    const curArr = curVal
      ? Array.isArray(curVal)
        ? curVal
        : [curVal]
      : [];
    const prevArr = prevVal
      ? Array.isArray(prevVal)
        ? prevVal
        : [prevVal]
      : [];

    const curSet = new Set(curArr);
    const prevSet = new Set(prevArr);

    const added = curArr.filter((v) => !prevSet.has(v));
    const removed = prevArr.filter((v) => !curSet.has(v));
    const kept = curArr.filter((v) => prevSet.has(v));

    if (added.length > 0 || removed.length > 0) {
      diffs.push({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        added,
        removed,
        kept,
      });
    }
  }

  return diffs.length > 0 ? diffs : null;
}

function GenerationGroup({
  generation,
  index,
  imageUrls,
  selectedImageId,
  onSelect,
  defaultOpen,
  allGenerations,
  previousGeneration,
}: {
  generation: Generation;
  index: number;
  imageUrls: Record<string, string>;
  selectedImageId: string | null;
  onSelect: (id: string) => void;
  defaultOpen: boolean;
  allGenerations: Generation[];
  previousGeneration?: Generation;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showDiff, setShowDiff] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  const date =
    typeof generation.createdAt === "string"
      ? new Date(generation.createdAt)
      : generation.createdAt;
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const jobType = generation.jobType ?? "generate";
  const Icon = JOB_TYPE_ICON[jobType] ?? Sparkles;
  const parentGenIndex = findParentGenerationIndex(
    generation.parentImageId,
    allGenerations
  );

  const modelLabel = getModelLabel(generation.model);

  const attrs = asAttributeSnapshot(generation.attributeSnapshot);
  const textLayers = asTextLayerSnapshot(generation.textLayerSnapshot);

  const attrDiff = showDiff
    ? computeAttributeDiff(
        attrs,
        asAttributeSnapshot(previousGeneration?.attributeSnapshot)
      )
    : null;

  const promptChanged =
    showDiff &&
    previousGeneration?.prompt != null &&
    generation.prompt != null &&
    generation.prompt !== previousGeneration.prompt;

  const modelChanged =
    showDiff &&
    previousGeneration?.model != null &&
    generation.model != null &&
    generation.model !== previousGeneration.model;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors">
        <ChevronRight
          className={`size-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="font-medium">#{index}</span>
        {parentGenIndex && (
          <span className="text-xs text-muted-foreground">
            {jobType === "inpaint" ? "edit on" : "from"} #{parentGenIndex}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {generation.images.length}{" "}
          {generation.images.length === 1 ? "image" : "images"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{timeStr}</span>
        {modelLabel && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {modelLabel}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex gap-3 px-2 py-1.5">
          {/* Left: thumbnails */}
          <div className="flex shrink-0 self-start gap-1.5">
            {generation.parentImage &&
              imageUrls[generation.parentImage.id] && (
                <>
                  <div
                    className="overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 opacity-60"
                    style={{ width: 36, aspectRatio: "1600/2560" }}
                  >
                    <Image
                      src={imageUrls[generation.parentImage.id]}
                      alt="Source"
                      width={36}
                      height={58}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <ChevronRight className="size-3" />
                  </div>
                </>
              )}
            {generation.images.map((img) => (
              <button
                key={img.id}
                onClick={() => onSelect(img.id)}
                className={`overflow-hidden rounded-lg border-2 transition-all ${
                  selectedImageId === img.id
                    ? "border-primary shadow-md"
                    : "border-transparent hover:border-muted-foreground/30"
                }`}
                style={{ width: 44, aspectRatio: "1600/2560" }}
              >
                {imageUrls[img.id] ? (
                  <Image
                    src={imageUrls[img.id]}
                    alt={`Option ${img.id.slice(0, 4)}`}
                    width={44}
                    height={70}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <Skeleton className="h-full w-full" />
                )}
              </button>
            ))}
          </div>

          {/* Right: details */}
          <div className="min-w-0 flex-1 space-y-1 text-xs">
            {/* Prompt */}
            {generation.prompt ? (
              <div>
                <span className="font-medium text-muted-foreground">
                  {jobType === "inpaint" ? "Edit prompt: " : "Prompt: "}
                </span>
                <span className={!promptExpanded ? "line-clamp-2" : ""}>
                  {generation.prompt}
                </span>
                {generation.prompt.length > 120 && (
                  <button
                    onClick={() => setPromptExpanded((e) => !e)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    {promptExpanded ? "less" : "more"}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground italic">
                Prompt generated by AI
              </div>
            )}

            {/* Attributes */}
            {attrs ? (
              <div className="text-muted-foreground">
                {formatAttributes(attrs)}
              </div>
            ) : (
              <div className="text-muted-foreground/60 italic">
                Attributes not recorded
              </div>
            )}

            {/* Text layers */}
            {textLayers && textLayers.length > 0 && (
              <div className="text-muted-foreground">
                <span className="font-medium">Layers: </span>
                {textLayers
                  .map((l) => `"${l.text || l.name}"`)
                  .join(", ")}
              </div>
            )}

            {/* Diff toggle */}
            {previousGeneration && (
              <div>
                <button
                  onClick={() => setShowDiff((d) => !d)}
                  className="text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                >
                  {showDiff
                    ? `Hide changes`
                    : `Changes from #${index - 1}`}
                </button>
                {showDiff && (
                  <div className="mt-1 space-y-0.5 rounded border border-dashed bg-muted/20 px-2 py-1.5">
                    {promptChanged && (
                      <div className="text-muted-foreground">
                        Prompt changed
                      </div>
                    )}
                    {modelChanged && (
                      <div className="text-muted-foreground">
                        Model: {getModelLabel(previousGeneration?.model)}{" "}
                        → {getModelLabel(generation.model)}
                      </div>
                    )}
                    {attrDiff ? (
                      <div className="space-y-0.5">
                        {attrDiff.map((d) => (
                          <div key={d.key}>
                            <span className="font-medium text-muted-foreground">
                              {d.label}:{" "}
                            </span>
                            {d.added.map((v) => (
                              <span
                                key={`+${v}`}
                                className="mr-1 font-semibold text-primary"
                              >
                                +{v}
                              </span>
                            ))}
                            {d.kept.map((v) => (
                              <span key={`=${v}`} className="mr-1">
                                {v}
                              </span>
                            ))}
                            {d.removed.map((v) => (
                              <span
                                key={`-${v}`}
                                className="mr-1 text-muted-foreground line-through"
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      !promptChanged &&
                      !modelChanged && (
                        <div className="text-muted-foreground/60 italic">
                          No attribute changes
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
