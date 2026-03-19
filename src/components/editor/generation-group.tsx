"use client";

import { Fragment, useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronRight, Sparkles, Pencil, Layers, Coins, Minus, Plus, ArrowLeftRight, X } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { updateGenerationName } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { JOB_TYPE, AI_MODELS } from "@/lib/constants";
import type { Generation } from "./types";
import { asAttributeSnapshot, asDescriptionSnapshot, asTextLayerSnapshot } from "./types";
import {
  JOB_TYPE_ICON,
  getModelLabel,
  findParentGenerationIndex,
  formatRelativeTime,
} from "./generation-helpers";
import { DiffDisplay } from "./diff-display";

const THUMB_SIZE = 48; // px — grid cells auto-size from this minimum
const MAX_GRID_SLOTS = 8;

export interface GenerationGroupProps {
  generation: Generation;
  index: number;
  imageUrls: Record<string, string>;
  selectedImageId: string | null;
  onSelect: (id: string) => void;
  onExpandImage: (imageId: string) => void;
  expandRequest: { imageId: string; seq: number } | null;
  defaultOpen: boolean;
  allGenerations: Generation[];
  onNameChange: (genId: string, name: string) => void;
  getDisplayName: (gen: Generation) => string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  showPrompt: boolean;
  draftImageIds: Set<string>;
  onDiscardDrafts: () => void;
  onGenerateMore: (generation: Generation, imageCount: number) => Promise<void>;
}

export function GenerationGroup({
  generation,
  index,
  imageUrls,
  selectedImageId,
  onSelect,
  onExpandImage,
  expandRequest,
  defaultOpen,
  allGenerations,
  onNameChange,
  getDisplayName,
  scrollContainerRef,
  draftImageIds,
  onDiscardDrafts,
  onGenerateMore,
}: GenerationGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showDiff, setShowDiff] = useState(false);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(true);
  const [sysPromptExpanded, setSysPromptExpanded] = useState(false);

  const [editing, setEditing] = useState(false);
  const displayName = getDisplayName(generation);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [ghostPopoverIdx, setGhostPopoverIdx] = useState<number | null>(null);
  const [ghostImageCount, setGhostImageCount] = useState(1);
  const ghostRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [comparePopoverOpen, setComparePopoverOpen] = useState(false);
  const compareAnchorRef = useRef<HTMLButtonElement | null>(null);

  const parentGeneration = generation.parentImageId
    ? allGenerations.find((g) =>
        g.images.some((img) => img.id === generation.parentImageId)
      )
    : undefined;

  const compareTarget = compareTargetId
    ? allGenerations.find((g) => g.id === compareTargetId)
    : undefined;

  const compareTargetIndex = compareTarget
    ? allGenerations.length - allGenerations.indexOf(compareTarget)
    : null;
  const compareTargetName = compareTarget
    ? (() => {
        const name = getDisplayName(compareTarget);
        return name ? `${name} #${compareTargetIndex}` : `#${compareTargetIndex}`;
      })()
    : null;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Render-time state adjustment: auto-expand when selected image is in this group
  const [prevSelectedImageId, setPrevSelectedImageId] = useState(selectedImageId);
  if (selectedImageId !== prevSelectedImageId) {
    setPrevSelectedImageId(selectedImageId);
    if (generation.images.some((img) => img.id === selectedImageId)) {
      setOpen(true);
    }
  }

  // Render-time state adjustment: auto-expand on expandRequest
  const [prevExpandRequest, setPrevExpandRequest] = useState(expandRequest);
  if (expandRequest !== prevExpandRequest) {
    setPrevExpandRequest(expandRequest);
    if (expandRequest && generation.images.some((img) => img.id === expandRequest.imageId)) {
      setOpen(true);
    }
  }

  // Scroll to group after expand animation completes (DOM side-effect)
  useEffect(() => {
    if (expandRequest && generation.images.some((img) => img.id === expandRequest.imageId)) {
      setTimeout(() => {
        const container = scrollContainerRef.current;
        const el = groupRef.current;
        if (!container || !el) return;
        const elTop = el.getBoundingClientRect().top;
        const containerTop = container.getBoundingClientRect().top;
        const scrollTarget = container.scrollTop + (elTop - containerTop);
        container.scrollTo({ top: scrollTarget, behavior: "smooth" });
      }, 250);
    }
  }, [expandRequest, generation.images, scrollContainerRef]);

  async function saveName(value: string) {
    const trimmed = value.trim();
    onNameChange(generation.id, trimmed);
    setEditing(false);
    try {
      await updateGenerationName(generation.id, trimmed);
    } catch {
      onNameChange(generation.id, generation.name ?? "");
    }
  }

  const date =
    typeof generation.createdAt === "string"
      ? new Date(generation.createdAt)
      : generation.createdAt;
  const timeStr = formatRelativeTime(date);

  const jobType = generation.jobType ?? JOB_TYPE.GENERATE;
  const Icon = JOB_TYPE_ICON[jobType] ?? Sparkles;
  const parentGenIndex = findParentGenerationIndex(
    generation.parentImageId,
    allGenerations
  );

  const modelLabel = getModelLabel(generation.model);
  const perImageCost = AI_MODELS.find((m) => m.value === generation.model)?.creditCost ?? 5;
  const ghostCount =
    jobType === JOB_TYPE.GENERATE && generation.images.length < MAX_GRID_SLOTS
      ? MAX_GRID_SLOTS - generation.images.length
      : 0;

  const attrs = asAttributeSnapshot(generation.attributeSnapshot);
  const hasDisplayAttrs = attrs !== null && Object.keys(attrs).length > 0;
  const descSnap = asDescriptionSnapshot(generation.descriptionSnapshot);

  const textLayers = asTextLayerSnapshot(generation.textLayerSnapshot);

  return (
    <Collapsible open={open} onOpenChange={setOpen} ref={groupRef}>
      <CollapsibleTrigger className="group/gen relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors">
        <ChevronRight
          className={`size-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") saveName(editValue);
              if (e.key === "Escape") {
                setEditing(false);
                setEditValue("");
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => saveName(editValue)}
            className="h-5 w-28 rounded border bg-background px-1.5 text-sm font-medium outline-none focus:ring-1 focus:ring-ring"
            placeholder={`#${index}`}
          />
        ) : (
          <>
            <span className="font-medium">
              {displayName ? `${displayName} · #${index}` : `#${index}`}
            </span>
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditValue(displayName);
                setEditing(true);
              }}
              className="opacity-0 group-hover/gen:opacity-100 transition-opacity cursor-pointer"
            >
              <Pencil className="size-3 text-muted-foreground hover:text-foreground" />
            </span>
          </>
        )}
        {parentGenIndex && (
          <span
            role="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (generation.parentImageId) {
                onSelect(generation.parentImageId);
                onExpandImage(generation.parentImageId);
              }
            }}
          >
            {jobType === JOB_TYPE.INPAINT ? "edit on" : "from"}{" "}
            {(() => {
              const parentGen = allGenerations.find((g) =>
                g.images.some(
                  (img) => img.id === generation.parentImageId
                )
              );
              const parentName = parentGen
                ? getDisplayName(parentGen)
                : "";
              return parentName
                ? `${parentName} #${parentGenIndex}`
                : `#${parentGenIndex}`;
            })()}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {generation.images.length}{" "}
          {generation.images.length === 1 ? "image" : "images"}
        </span>
        {allGenerations.length > 1 && open && (
          <div className="absolute left-[15rem] flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <span className="h-3.5 w-px bg-border" />
            <span
              ref={compareAnchorRef}
              role="button"
              onClick={() => {
                if (compareTargetId !== null) {
                  setCompareTargetId(null);
                  setComparePopoverOpen(false);
                } else {
                  setCompareTargetId("");
                  setComparePopoverOpen(true);
                  setOpen(true);
                }
              }}
              className={`cursor-pointer transition-colors ${
                compareTargetId !== null
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowLeftRight className="size-3.5" />
            </span>
            {compareTarget && compareTargetName && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 gap-0.5 cursor-pointer hover:bg-muted/50"
                onClick={() => setComparePopoverOpen(true)}
              >
                vs {compareTargetName}
              </Badge>
            )}
            {compareTargetId !== null && (
              <span
                role="button"
                onClick={() => {
                  setCompareTargetId(null);
                  setComparePopoverOpen(false);
                }}
                className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3" />
              </span>
            )}
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground" title={date.toLocaleString()}>{timeStr}</span>
        {generation.includeLayers && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
            <Layers className="size-2.5" />
            Layers
          </Badge>
        )}
        {modelLabel && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {modelLabel}
          </Badge>
        )}
        <Icon className="size-3.5 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex gap-3 px-2 py-1.5">
          {/* Left: thumbnails */}
          <div className="w-56 shrink-0 self-start">
            {generation.parentImage &&
              imageUrls[generation.parentImage.id] && (
                <div className="mb-1.5 flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      onSelect(generation.parentImage!.id);
                      onExpandImage(generation.parentImage!.id);
                    }}
                    className="overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
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
                  </button>
                  <ChevronRight className="size-3 text-muted-foreground rotate-90" />
                </div>
              )}
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_SIZE}px, 1fr))` }}
            >
              {generation.images.map((img) => {
                const hasDraft = draftImageIds.has(img.id);
                const isSelected = selectedImageId === img.id;
                return (
                  <div key={img.id} className="relative">
                    <button
                      onClick={() => onSelect(img.id)}
                      className={`w-full origin-center overflow-hidden rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-primary shadow-md ring-2 ring-primary/20 scale-105"
                          : "border-transparent hover:border-muted-foreground/30"
                      }`}
                      style={{ aspectRatio: "1600/2560" }}
                    >
                      {imageUrls[img.id] ? (
                        <Image
                          src={imageUrls[img.id]}
                          alt={`Option ${img.id.slice(0, 4)}`}
                          width={THUMB_SIZE}
                          height={Math.round(THUMB_SIZE * (2560 / 1600))}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <Skeleton className="h-full w-full" />
                      )}
                    </button>
                    {hasDraft && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={<button type="button" />}
                            className="absolute -top-1 -right-1 flex items-center justify-center size-3.5 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(img.id);
                              onDiscardDrafts();
                            }}
                          >
                            <span className="size-2 rounded-full bg-amber-500 ring-1 ring-background" />
                          </TooltipTrigger>
                          <TooltipContent side="top">Click to reset to generated values</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                );
              })}
              {Array.from({ length: ghostCount }, (_, i) => (
                <button
                  key={`ghost-${i}`}
                  ref={(el) => { ghostRefs.current[i] = el; }}
                  onClick={() => setGhostPopoverIdx(i)}
                  className="w-full rounded-lg border-2 border-dashed border-muted-foreground/20
                             flex items-center justify-center cursor-pointer
                             hover:border-muted-foreground/40 hover:bg-muted/30 transition-colors"
                  style={{ aspectRatio: "1600/2560" }}
                >
                  <Sparkles className="size-3.5 text-muted-foreground/30" />
                </button>
              ))}
            </div>
            <PopoverPrimitive.Root
              open={ghostPopoverIdx !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setGhostPopoverIdx(null);
                  setGhostImageCount(1);
                }
              }}
            >
              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Positioner
                  className="isolate z-50"
                  anchor={ghostPopoverIdx !== null ? ghostRefs.current[ghostPopoverIdx] ?? undefined : undefined}
                  side="right"
                  sideOffset={8}
                  align="center"
                >
                  <PopoverPrimitive.Popup className="z-50 w-48 rounded-lg border bg-popover p-3 shadow-md text-xs space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">Generate more?</p>
                      <Badge variant="secondary">{modelLabel}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Images</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setGhostImageCount((c) => Math.max(1, c - 1))}
                          disabled={ghostImageCount <= 1}
                          className="flex size-5 items-center justify-center rounded border bg-background hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="size-2.5" />
                        </button>
                        <span className="w-5 text-center font-medium tabular-nums">{ghostImageCount}</span>
                        <button
                          onClick={() => setGhostImageCount((c) => Math.min(ghostCount, c + 1))}
                          disabled={ghostImageCount >= ghostCount}
                          className="flex size-5 items-center justify-center rounded border bg-background hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="size-2.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={async () => {
                          const count = ghostImageCount;
                          setGhostPopoverIdx(null);
                          setGhostImageCount(1);
                          await onGenerateMore(generation, count);
                        }}
                      >
                        <Sparkles className="size-3.5 mr-1.5" />
                        Generate
                      </Button>
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Coins className="size-3 text-yellow-500" />
                        <span>{ghostImageCount * perImageCost} credits</span>
                      </div>
                    </div>
                  </PopoverPrimitive.Popup>
                </PopoverPrimitive.Positioner>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          </div>

          {/* Right: details */}
          <div className="min-w-0 flex-1 space-y-1 text-xs">
            {/* Inpaint: edit prompt */}
            {jobType === JOB_TYPE.INPAINT && generation.prompt ? (
              <>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Edit prompt:{" "}
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
                {compareTarget && (
                  <DiffDisplay current={generation} target={compareTarget} />
                )}
              </>
            ) : compareTarget ? (
              <DiffDisplay current={generation} target={compareTarget} />
            ) : (
              <>
                {/* Structured attributes */}
                {hasDisplayAttrs && (
                  <div className="space-y-0.5">
                    {Object.entries(attrs!).map(([key, val]) => {
                      const meta = descSnap?.[key];
                      const label = meta?.name ?? key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      const values = Array.isArray(val) ? val : [val];
                      return (
                        <div key={key}>
                          {meta?.description ? (
                            <HoverCard>
                              <HoverCardTrigger
                                render={<span />}
                                className="font-medium underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 cursor-help"
                              >
                                {label}:
                              </HoverCardTrigger>
                              <HoverCardContent side="right" className="text-sm">
                                {meta.description}
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="font-medium">{label}:</span>
                          )}{" "}
                          {values.map((v, i) => {
                            const vLabel = v === "true" ? "yes" : v === "false" ? "no" : (meta?.values[v]?.label ?? v);
                            const vDesc = meta?.values[v]?.description;
                            return (
                              <Fragment key={v}>
                                {i > 0 && ", "}
                                {vDesc ? (
                                  <HoverCard>
                                    <HoverCardTrigger
                                      render={<span />}
                                      className="underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 cursor-help"
                                    >
                                      {vLabel}
                                    </HoverCardTrigger>
                                    <HoverCardContent className="text-sm">
                                      {vDesc}
                                    </HoverCardContent>
                                  </HoverCard>
                                ) : (
                                  vLabel
                                )}
                              </Fragment>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Layers */}
            {textLayers && textLayers.length > 0 && (
              <div className="text-muted-foreground space-x-1">
                <span className="font-medium">Layers:</span>
                {textLayers.map((l, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <span className={l.visible === false ? "line-through opacity-50" : ""}>
                      &quot;{l.text || l.name}&quot;
                    </span>
                    {l.type && (
                      <span className="text-[10px] opacity-60 ml-0.5">
                        {l.type}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* System prompt */}
            {jobType !== JOB_TYPE.INPAINT && generation.prompt && (
              <div>
                <button
                  onClick={() => setSysPromptExpanded((e) => !e)}
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  {sysPromptExpanded
                    ? "Hide system prompt"
                    : "Show system prompt"}
                </button>
                {sysPromptExpanded && (
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground border rounded-md p-2 bg-muted/30">
                    {generation.prompt}
                  </div>
                )}
              </div>
            )}


            {/* Changes from parent */}
            {parentGeneration && (
              <div>
                <button
                  onClick={() => setShowDiff((d) => !d)}
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  {showDiff
                    ? "Hide changes"
                    : `Changes from ${(() => {
                        const name = getDisplayName(parentGeneration);
                        const pIdx = findParentGenerationIndex(
                          generation.parentImageId,
                          allGenerations
                        );
                        return name
                          ? `${name} #${pIdx}`
                          : `#${pIdx}`;
                      })()}`}
                </button>
                {showDiff && (
                  <DiffDisplay
                    current={generation}
                    target={parentGeneration}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
      <PopoverPrimitive.Root
        open={comparePopoverOpen}
        onOpenChange={setComparePopoverOpen}
      >
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            className="isolate z-50"
            anchor={compareAnchorRef.current ?? undefined}
            side="bottom"
            sideOffset={4}
            align="start"
          >
            <PopoverPrimitive.Popup className="z-50 w-64 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md text-xs">
              {allGenerations
                .filter((g) => g.id !== generation.id)
                .map((g) => {
                  const gIdx = allGenerations.length - allGenerations.indexOf(g);
                  const name = getDisplayName(g);
                  const gModel = getModelLabel(g.model);
                  const gIcon = JOB_TYPE_ICON[g.jobType ?? JOB_TYPE.GENERATE] ?? Sparkles;
                  const GIcon = gIcon;
                  const gDate = typeof g.createdAt === "string" ? new Date(g.createdAt) : g.createdAt;
                  const isSelected = compareTargetId === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => {
                        setCompareTargetId(g.id);
                        setComparePopoverOpen(false);
                      }}
                      className={`w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors cursor-pointer ${
                        isSelected ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <GIcon className="size-3 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {name ? `#${gIdx} · ${name}` : `#${gIdx}`}
                        </span>
                        <span className="ml-auto text-muted-foreground shrink-0">
                          {formatRelativeTime(gDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-[18px] text-muted-foreground">
                        {gModel && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            {gModel}
                          </Badge>
                        )}
                        <span>
                          {g.images.length} {g.images.length === 1 ? "image" : "images"}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </Collapsible>
  );
}
