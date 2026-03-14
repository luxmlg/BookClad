"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronRight, Sparkles, Copy, Wand2, Pencil } from "lucide-react";
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
  name?: string | null;
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
}

export function GenerationHistory({
  generations,
  imageUrls,
  selectedImageId,
  onSelect,
}: GenerationHistoryProps) {
  const expandSeqRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [expandRequest, setExpandRequest] = useState<{
    imageId: string;
    seq: number;
  } | null>(null);
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(
    {}
  );

  const handleExpandImage = (imageId: string) => {
    setExpandRequest({ imageId, seq: ++expandSeqRef.current });
  };

  const handleNameChange = (genId: string, name: string) => {
    setNameOverrides((prev) => ({ ...prev, [genId]: name }));
  };

  const getDisplayName = (gen: Generation) => {
    if (gen.id in nameOverrides) return nameOverrides[gen.id];
    return gen.name ?? "";
  };

  if (generations.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No completed generations yet
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
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
            onExpandImage={handleExpandImage}
            expandRequest={expandRequest}
            defaultOpen={idx === 0}
            allGenerations={generations}
            onNameChange={handleNameChange}
            getDisplayName={getDisplayName}
            scrollContainerRef={scrollContainerRef}
          />
        ))}
      </div>
    </div>
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

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function DiffDisplay({
  current,
  target,
}: {
  current: Generation;
  target: Generation;
}) {
  const curAttrs = asAttributeSnapshot(current.attributeSnapshot);
  const targetAttrs = asAttributeSnapshot(target.attributeSnapshot);
  const curTextLayers = asTextLayerSnapshot(current.textLayerSnapshot);

  const attrDiff = computeAttributeDiff(curAttrs, targetAttrs);

  const promptChanged =
    target.prompt != null &&
    current.prompt != null &&
    current.prompt !== target.prompt;

  const modelChanged =
    target.model != null &&
    current.model != null &&
    current.model !== target.model;

  const imageCountChanged =
    target.imageCount != null &&
    current.imageCount != null &&
    current.imageCount !== target.imageCount;

  const jobTypeChanged =
    target.jobType != null &&
    current.jobType != null &&
    current.jobType !== target.jobType;

  const prevLayers = asTextLayerSnapshot(target.textLayerSnapshot);
  const prevTexts = (prevLayers ?? []).map((l) => l.text || l.name);
  const curTexts = (curTextLayers ?? []).map((l) => l.text || l.name);
  const prevStr = prevTexts.join(", ");
  const curStr = curTexts.join(", ");
  const textLayersChanged =
    (prevLayers || curTextLayers) && prevStr !== curStr;

  return (
    <div className="mt-1 space-y-1.5 rounded border border-dashed bg-muted/20 px-2 py-1.5">
      {promptChanged && (
        <div>
          <span className="font-medium text-muted-foreground">Prompt: </span>
          <div className="mt-0.5 space-y-0.5">
            <div className="text-muted-foreground">{target.prompt}</div>
            <div>→ {current.prompt}</div>
          </div>
        </div>
      )}
      {modelChanged && (
        <div>
          <span className="font-medium text-muted-foreground">Model: </span>
          <span className="text-muted-foreground mr-1">
            {getModelLabel(target.model)}
          </span>
          → <span>{getModelLabel(current.model)}</span>
        </div>
      )}
      {imageCountChanged && (
        <div>
          <span className="font-medium text-muted-foreground">
            Image count:{" "}
          </span>
          <span className="text-muted-foreground mr-1">
            {target.imageCount}
          </span>
          → <span>{current.imageCount}</span>
        </div>
      )}
      {jobTypeChanged && (
        <div>
          <span className="font-medium text-muted-foreground">Type: </span>
          <span className="text-muted-foreground mr-1">
            {target.jobType}
          </span>
          → <span>{current.jobType}</span>
        </div>
      )}
      {attrDiff && (
        <div className="space-y-0.5">
          {attrDiff.map((d) => (
            <div key={d.key}>
              <span className="font-medium text-muted-foreground">
                {d.label}:{" "}
              </span>
              <span className="text-muted-foreground mr-1">
                {[...d.kept, ...d.removed].join(", ")}
              </span>
              → <span>{[...d.kept, ...d.added].join(", ")}</span>
            </div>
          ))}
        </div>
      )}
      {textLayersChanged && (
        <div>
          <span className="font-medium text-muted-foreground">
            Text layers:{" "}
          </span>
          {prevTexts.length > 0 && (
            <span className="text-muted-foreground mr-1">
              {prevTexts.map((t) => `"${t}"`).join(", ")}
            </span>
          )}
          {curTexts.length > 0 && (
            <>
              {prevTexts.length > 0 && "→ "}
              <span>{curTexts.map((t) => `"${t}"`).join(", ")}</span>
            </>
          )}
        </div>
      )}
      {!promptChanged &&
        !modelChanged &&
        !attrDiff &&
        !imageCountChanged &&
        !jobTypeChanged &&
        !textLayersChanged && (
          <div className="text-muted-foreground/60 italic">No changes</div>
        )}
    </div>
  );
}

function GenerationGroup({
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
}: {
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
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showDiff, setShowDiff] = useState(false);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const displayName = getDisplayName(generation);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const parentGeneration = generation.parentImageId
    ? allGenerations.find((g) =>
        g.images.some((img) => img.id === generation.parentImageId)
      )
    : undefined;

  const compareTarget = compareTargetId
    ? allGenerations.find((g) => g.id === compareTargetId)
    : undefined;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (
      selectedImageId &&
      generation.images.some((img) => img.id === selectedImageId)
    ) {
      setOpen(true);
    }
  }, [selectedImageId, generation.images]);

  useEffect(() => {
    if (
      expandRequest &&
      generation.images.some((img) => img.id === expandRequest.imageId)
    ) {
      setOpen(true);
      // Wait for collapsible animation (200ms) to fully complete, then scroll
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
  }, [expandRequest, generation.images]);

  async function saveName(value: string) {
    const trimmed = value.trim();
    onNameChange(generation.id, trimmed);
    setEditing(false);
    try {
      await fetch(`/api/generations/${generation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
    } catch {
      onNameChange(generation.id, generation.name ?? "");
    }
  }

  const date =
    typeof generation.createdAt === "string"
      ? new Date(generation.createdAt)
      : generation.createdAt;
  const timeStr = formatRelativeTime(date);

  const jobType = generation.jobType ?? "generate";
  const Icon = JOB_TYPE_ICON[jobType] ?? Sparkles;
  const parentGenIndex = findParentGenerationIndex(
    generation.parentImageId,
    allGenerations
  );

  const modelLabel = getModelLabel(generation.model);

  const attrs = asAttributeSnapshot(generation.attributeSnapshot);
  const textLayers = asTextLayerSnapshot(generation.textLayerSnapshot);

  return (
    <Collapsible open={open} onOpenChange={setOpen} ref={groupRef}>
      <CollapsibleTrigger className="group/gen flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors">
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
            {jobType === "inpaint" ? "edit on" : "from"}{" "}
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
        <span className="ml-auto text-xs text-muted-foreground" title={date.toLocaleString()}>{timeStr}</span>
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
          <div className="flex shrink-0 self-start gap-1.5">
            {generation.parentImage &&
              imageUrls[generation.parentImage.id] && (
                <>
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
                  <div className="flex items-center text-muted-foreground">
                    <ChevronRight className="size-3" />
                  </div>
                </>
              )}
            {generation.images.map((img) => (
              <button
                key={img.id}
                onClick={() => onSelect(img.id)}
                className={`origin-center overflow-hidden rounded-lg border-2 transition-all ${
                  selectedImageId === img.id
                    ? "border-primary shadow-md ring-2 ring-primary/20 scale-105"
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

            {/* Auto-diff with parent */}
            {parentGeneration && (
              <div>
                <button
                  onClick={() => setShowDiff((d) => !d)}
                  className="text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
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

            {/* Manual compare */}
            <div>
              {compareTargetId === null ? (
                <button
                  onClick={() => setCompareTargetId("")}
                  className="text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                >
                  Compare
                </button>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-medium">
                      Compare with:
                    </span>
                    <select
                      value={compareTargetId}
                      onChange={(e) => setCompareTargetId(e.target.value)}
                      className="h-6 rounded border bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select...</option>
                      {allGenerations
                        .filter((g) => g.id !== generation.id)
                        .map((g) => {
                          const gIdx = findParentGenerationIndex(
                            g.images[0]?.id,
                            allGenerations
                          );
                          const name = getDisplayName(g);
                          return (
                            <option key={g.id} value={g.id}>
                              {name ? `${name} #${gIdx}` : `#${gIdx}`}
                            </option>
                          );
                        })}
                    </select>
                    <button
                      onClick={() => setCompareTargetId(null)}
                      className="text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                    >
                      Hide
                    </button>
                  </div>
                  {compareTarget && (
                    <DiffDisplay
                      current={generation}
                      target={compareTarget}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
