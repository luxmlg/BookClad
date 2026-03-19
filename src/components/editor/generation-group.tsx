"use client";

import { Fragment, useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronRight, Sparkles, Pencil, Ellipsis, Layers, Coins, Minus, Plus, ArrowLeftRight, X, Loader2, Check, Images, RefreshCw, Trash2 } from "lucide-react";
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
import { JOB_TYPE, AI_MODELS, GENERATION_STATUS } from "@/lib/constants";
import type { Generation } from "./types";
import { asAttributeSnapshot, asDescriptionSnapshot, asTextLayerSnapshot } from "./types";
import {
  JOB_TYPE_ICON,
  getModelLabel,
  findParentGenerationIndex,
  formatRelativeTime,
} from "./generation-helpers";
import { DiffDisplay } from "./diff-display";
import { ImageContextMenu } from "./image-context-menu";

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
  activeIds: Set<string>;
  pendingSlotCounts: Map<string, number>;
  unseenImageIds: Set<string>;
  multiSelectIds: Set<string>;
  onMultiSelectToggle: (imageId: string) => void;
  onMultiSelectClear: () => void;
  onDeleteImages: (imageIds: string[]) => void;
  onRegenerateImages: (imageIds: string[]) => void;
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
  activeIds,
  pendingSlotCounts,
  unseenImageIds,
  multiSelectIds,
  onMultiSelectToggle,
  onMultiSelectClear,
  onDeleteImages,
  onRegenerateImages,
}: GenerationGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showDiff, setShowDiff] = useState(false);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(true);
  const [sysPromptExpanded, setSysPromptExpanded] = useState(false);

  const displayName = getDisplayName(generation);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [ghostPopoverIdx, setGhostPopoverIdx] = useState<number | null>(null);
  const [ghostImageCount, setGhostImageCount] = useState(1);
  const ghostRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [comparePopoverOpen, setComparePopoverOpen] = useState(false);
  const [headerPopover, setHeaderPopover] = useState<"regenerate" | "delete" | null>(null);
  const regenerateAnchorRef = useRef<HTMLSpanElement | null>(null);
  const deleteAnchorRef = useRef<HTMLSpanElement | null>(null);
  const compareAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [morePopover, setMorePopover] = useState<"menu" | "rename" | "confirm-delete" | null>(null);
  const moreAnchorRef = useRef<HTMLSpanElement | null>(null);

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
    if (morePopover === "rename" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [morePopover]);

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

  const isActive = activeIds.has(generation.id)
    || generation.status === GENERATION_STATUS.QUEUED
    || generation.status === GENERATION_STATUS.PROCESSING;

  const pendingCount = isActive
    ? (pendingSlotCounts.get(generation.id)
        ?? Math.max(0, (generation.imageCount ?? 0) - generation.images.length))
    : 0;

  const ghostCount =
    !isActive && jobType === JOB_TYPE.GENERATE && generation.images.length < MAX_GRID_SLOTS
      ? MAX_GRID_SLOTS - generation.images.length
      : 0;

  const attrs = asAttributeSnapshot(generation.attributeSnapshot);
  const hasDisplayAttrs = attrs !== null && Object.keys(attrs).length > 0;
  const descSnap = asDescriptionSnapshot(generation.descriptionSnapshot);

  const textLayers = asTextLayerSnapshot(generation.textLayerSnapshot);

  return (
    <Collapsible open={open || isActive} onOpenChange={setOpen} ref={groupRef}>
      <CollapsibleTrigger className="group/gen relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors">
        <ChevronRight
          className={`size-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
        <span
          ref={moreAnchorRef}
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            setMorePopover(morePopover ? null : "menu");
          }}
          className="font-medium shrink-0 tabular-nums w-8 mr-1 inline-flex items-center justify-end cursor-pointer"
        >
          <span className="group-hover/gen:hidden">#{index}</span>
          <Ellipsis className="size-3.5 text-muted-foreground hidden group-hover/gen:block" />
        </span>
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
        {multiSelectIds.size > 0 ? (
          <span className="flex items-center gap-1.5 text-xs text-primary font-medium" onClick={(e) => e.stopPropagation()}>
            <span className="flex items-center gap-1">
              <span className="font-semibold">{multiSelectIds.size}</span>
              <Images className="size-3.5" />
              selected
            </span>
            {jobType === JOB_TYPE.GENERATE && (
              <span
                ref={regenerateAnchorRef}
                role="button"
                onClick={() => setHeaderPopover(headerPopover === "regenerate" ? null : "regenerate")}
                className="rounded-sm cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                title="Regenerate selected"
              >
                <RefreshCw className="size-3" />
              </span>
            )}
            <span
              ref={deleteAnchorRef}
              role="button"
              onClick={() => setHeaderPopover(headerPopover === "delete" ? null : "delete")}
              className="rounded-sm cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
              title="Delete selected"
            >
              <Trash2 className="size-3" />
            </span>
            <span className="h-3 w-px bg-border" />
            <span
              role="button"
              onClick={onMultiSelectClear}
              className="rounded-sm cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              title="Clear selection"
            >
              <X className="size-3" />
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {isActive
              ? (generation.images.length + pendingCount)
              : generation.images.length}
            <Images className="size-3.5" />
          </span>
        )}
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
        {displayName && (
          <span className="absolute inset-x-0 text-center text-sm font-medium truncate pointer-events-none px-[30%]">
            {displayName}
          </span>
        )}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground" title={date.toLocaleString()}>{timeStr}</span>
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
        {isActive && <Loader2 className="size-3 animate-spin text-primary" />}
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
            <ImageContextMenu
              generationJobType={jobType}
              perImageCost={perImageCost}
              multiSelectIds={multiSelectIds}
              onMultiSelectClear={onMultiSelectClear}
              onDeleteImages={onDeleteImages}
              onRegenerateImages={onRegenerateImages}
            >
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_SIZE}px, 1fr))` }}
            >
              {generation.images.map((img) => {
                const hasDraft = draftImageIds.has(img.id);
                const isCanvasSelected = selectedImageId === img.id;
                const isMultiSelected = multiSelectIds.has(img.id);
                const hasAnyMultiSelect = multiSelectIds.size > 0;
                const isUnseen = unseenImageIds.has(img.id) && !isCanvasSelected;
                return (
                  <div key={img.id} className="group/thumb relative">
                    <button
                      data-image-id={img.id}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) {
                          onMultiSelectToggle(img.id);
                        } else {
                          onMultiSelectClear();
                          onSelect(img.id);
                        }
                      }}
                      className={`w-full origin-center overflow-hidden rounded-lg border-2 transition-all ${
                        isCanvasSelected
                          ? "border-primary shadow-md ring-2 ring-primary/20 scale-105"
                          : isMultiSelected
                            ? "border-primary/60 ring-1 ring-primary/20"
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
                    {/* Selection circle — top-left */}
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMultiSelectToggle(img.id);
                      }}
                      className={`absolute -top-1 -left-1 flex size-3.5 items-center justify-center rounded-full cursor-pointer transition-all ${
                        isMultiSelected
                          ? "bg-primary ring-1 ring-background opacity-100"
                          : hasAnyMultiSelect
                            ? "border border-muted-foreground/40 bg-background/80 ring-1 ring-background opacity-100 hover:border-primary"
                            : "border border-muted-foreground/30 bg-background/60 ring-1 ring-background opacity-0 group-hover/thumb:opacity-100 hover:border-primary"
                      }`}
                    >
                      {isMultiSelected && <Check className="size-2 text-primary-foreground" strokeWidth={3} />}
                    </span>
                    {isUnseen && (
                      <span className="absolute -top-1 -right-1 flex size-3 items-center justify-center">
                        <span className="absolute size-2.5 animate-ping rounded-full bg-primary/40" />
                        <span className="size-1.5 rounded-full bg-primary ring-1 ring-background" />
                      </span>
                    )}
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
              {Array.from({ length: pendingCount }, (_, i) => (
                <div
                  key={`loading-${i}`}
                  className="w-full rounded-lg border-2 border-dashed border-primary/20 overflow-hidden"
                  style={{ aspectRatio: "1600/2560" }}
                >
                  <div className="h-full w-full animate-pulse bg-primary/5 flex items-center justify-center">
                    <Loader2 className="size-3.5 animate-spin text-primary/30" />
                  </div>
                </div>
              ))}
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
            </ImageContextMenu>
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
                            const vMeta = meta?.values[v];
                            const vLabel = v === "true" ? "yes" : v === "false" ? "no" : (vMeta?.label ?? v);
                            const vDesc = vMeta?.description;
                            const vColors = vMeta?.colors;
                            return (
                              <Fragment key={v}>
                                {i > 0 && ", "}
                                {vColors && vColors.length > 0 && (
                                  <span className="inline-flex items-center gap-px align-middle mr-1">
                                    {vColors.map((color, ci) => (
                                      <span
                                        key={ci}
                                        className="inline-block size-2.5 rounded-full border border-border/50"
                                        style={{ backgroundColor: color }}
                                      />
                                    ))}
                                  </span>
                                )}
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
      {/* More menu popover (rename / delete generation) */}
      <PopoverPrimitive.Root
        open={morePopover !== null}
        onOpenChange={(open) => { if (!open) setMorePopover(null); }}
      >
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            className="isolate z-50"
            anchor={moreAnchorRef.current ?? undefined}
            side="bottom"
            sideOffset={4}
            align="start"
          >
            <PopoverPrimitive.Popup className="z-50 rounded-lg border bg-popover shadow-md text-xs">
              {morePopover === "menu" ? (
                <div className="p-1 w-36">
                  <button
                    className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-2"
                    onClick={() => {
                      setEditValue(displayName);
                      setMorePopover("rename");
                    }}
                  >
                    <Pencil className="size-3 text-muted-foreground" />
                    Rename
                  </button>
                  <button
                    className="w-full rounded-md px-2 py-1.5 text-left hover:bg-destructive/10 text-destructive transition-colors cursor-pointer flex items-center gap-2"
                    onClick={() => setMorePopover("confirm-delete")}
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </button>
                </div>
              ) : morePopover === "rename" ? (
                <div className="p-3 w-48 space-y-2">
                  <p className="font-medium">Rename</p>
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveName(editValue);
                        setMorePopover(null);
                      }
                      if (e.key === "Escape") setMorePopover(null);
                    }}
                    className="w-full rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                    placeholder={`#${index}`}
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setMorePopover(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        saveName(editValue);
                        setMorePopover(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 w-48 space-y-2.5">
                  <p className="font-medium">
                    Delete {generation.images.length === 1 ? "this image" : `all ${generation.images.length} images`}?
                  </p>
                  <p className="text-muted-foreground">This cannot be undone.</p>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setMorePopover("menu")}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        setMorePopover(null);
                        onDeleteImages(generation.images.map(img => img.id));
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      {/* Header action popovers */}
      <PopoverPrimitive.Root
        open={headerPopover !== null}
        onOpenChange={(open) => { if (!open) setHeaderPopover(null); }}
      >
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            className="isolate z-50"
            anchor={(headerPopover === "regenerate" ? regenerateAnchorRef : deleteAnchorRef).current ?? undefined}
            side="bottom"
            sideOffset={6}
            align="center"
          >
            <PopoverPrimitive.Popup className="z-50 w-48 rounded-lg border bg-popover p-3 shadow-md text-xs space-y-2.5">
              {headerPopover === "regenerate" ? (
                <>
                  <p className="font-medium">
                    Regenerate {multiSelectIds.size} {multiSelectIds.size === 1 ? "image" : "images"}?
                  </p>
                  <p className="text-muted-foreground">
                    Will delete and regenerate with the same settings.
                  </p>
                  <div className="flex items-center justify-between">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const ids = [...multiSelectIds];
                        setHeaderPopover(null);
                        onRegenerateImages(ids);
                      }}
                    >
                      <RefreshCw className="size-3 mr-1" />
                      Regenerate
                    </Button>
                  </div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Coins className="size-3 text-yellow-500" />
                    <span>{multiSelectIds.size * perImageCost} credits</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    Delete {multiSelectIds.size} {multiSelectIds.size === 1 ? "image" : "images"}?
                  </p>
                  <p className="text-muted-foreground">
                    This cannot be undone.
                  </p>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      const ids = [...multiSelectIds];
                      setHeaderPopover(null);
                      onDeleteImages(ids);
                    }}
                  >
                    <Trash2 className="size-3 mr-1" />
                    Delete
                  </Button>
                </>
              )}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </Collapsible>
  );
}
