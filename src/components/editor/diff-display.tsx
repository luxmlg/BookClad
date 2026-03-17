"use client";

import { Fragment, useState } from "react";
import { computeAttributeDiff } from "@/lib/attributes";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import type { Generation, DescriptionSnapshot } from "./types";
import {
  asAttributeSnapshot,
  asDescriptionSnapshot,
  asTextLayerSnapshot,
} from "./types";
import { getModelLabel } from "./generation-helpers";

interface DiffDisplayProps {
  current: Generation;
  target: Generation;
}

function resolveLabel(
  key: string,
  value: string,
  descSnap: DescriptionSnapshot | null,
): string {
  if (value === "true") return "yes";
  if (value === "false") return "no";
  return descSnap?.[key]?.values[value]?.label ?? value;
}

function resolveAttrName(
  key: string,
  curDesc: DescriptionSnapshot | null,
  targetDesc: DescriptionSnapshot | null,
): string {
  return (
    curDesc?.[key]?.name ??
    targetDesc?.[key]?.name ??
    key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function AttrNameHover({
  name,
  description,
  className,
}: {
  name: string;
  description?: string;
  className?: string;
}) {
  if (!description) {
    return <span className={className}>{name}:</span>;
  }
  return (
    <HoverCard>
      <HoverCardTrigger
        render={<span />}
        className={`${className ?? ""} underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 cursor-help`}
      >
        {name}:
      </HoverCardTrigger>
      <HoverCardContent side="right" className="text-sm">
        {description}
      </HoverCardContent>
    </HoverCard>
  );
}

function ValueHover({
  label,
  description,
  className,
}: {
  label: string;
  description?: string;
  className?: string;
}) {
  if (!description) {
    return <span className={className}>{label}</span>;
  }
  return (
    <HoverCard>
      <HoverCardTrigger
        render={<span />}
        className={`${className ?? ""} underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 cursor-help`}
      >
        {label}
      </HoverCardTrigger>
      <HoverCardContent className="text-sm">{description}</HoverCardContent>
    </HoverCard>
  );
}

export function DiffDisplay({ current, target }: DiffDisplayProps) {
  const [sysPromptExpanded, setSysPromptExpanded] = useState(false);

  const curAttrs = asAttributeSnapshot(current.attributeSnapshot);
  const targetAttrs = asAttributeSnapshot(target.attributeSnapshot);
  const curDesc = asDescriptionSnapshot(current.descriptionSnapshot);
  const targetDesc = asDescriptionSnapshot(target.descriptionSnapshot);
  const curTextLayers = asTextLayerSnapshot(current.textLayerSnapshot);

  // Attribute values diff
  const attrDiff = computeAttributeDiff(curAttrs, targetAttrs);

  // Attribute context diff (compare descriptions)
  const contextDiffs: Array<{
    key: string;
    name: string;
    oldDesc: string | null;
    newDesc: string | null;
  }> = [];
  if (curDesc || targetDesc) {
    const allDescKeys = new Set([
      ...Object.keys(curDesc ?? {}),
      ...Object.keys(targetDesc ?? {}),
    ]);
    for (const key of allDescKeys) {
      const curD = curDesc?.[key]?.description ?? null;
      const targetD = targetDesc?.[key]?.description ?? null;
      if (curD !== targetD) {
        contextDiffs.push({
          key,
          name: resolveAttrName(key, curDesc, targetDesc),
          oldDesc: targetD,
          newDesc: curD,
        });
      }
    }
  }

  // System prompt diff
  const sysPromptChanged =
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

  const includeLayersChanged =
    current.includeLayers !== target.includeLayers;

  const prevLayers = asTextLayerSnapshot(target.textLayerSnapshot);
  const layerKey = (l: {
    name: string;
    text: string;
    type?: string;
    visible?: boolean;
  }): string =>
    `${l.type ?? "text"}|${l.text || l.name}|${l.visible ?? true}`;
  const prevStr = (prevLayers ?? []).map(layerKey).join(",");
  const curStr = (curTextLayers ?? []).map(layerKey).join(",");
  const textLayersChanged =
    (prevLayers || curTextLayers) && prevStr !== curStr;

  const hasNoChanges =
    !attrDiff &&
    contextDiffs.length === 0 &&
    !sysPromptChanged &&
    !modelChanged &&
    !imageCountChanged &&
    !jobTypeChanged &&
    !includeLayersChanged &&
    !textLayersChanged;

  return (
    <div className="mt-1 space-y-1.5 rounded border border-dashed bg-muted/20 px-2 py-1.5">
      {/* Attribute value changes */}
      {attrDiff && (
        <div className="space-y-0.5">
          {attrDiff.map((d) => {
            const name = resolveAttrName(d.key, curDesc, targetDesc);
            const attrDesc = curDesc?.[d.key]?.description ?? targetDesc?.[d.key]?.description;
            const oldValues = [...d.kept, ...d.removed];
            const newValues = [...d.kept, ...d.added];

            const renderValues = (values: string[], descSnap: DescriptionSnapshot | null, className?: string) =>
              values.map((v, i) => {
                const vLabel = resolveLabel(d.key, v, descSnap);
                const vDesc = descSnap?.[d.key]?.values[v]?.description;
                return (
                  <Fragment key={v}>
                    {i > 0 && ", "}
                    <ValueHover label={vLabel} description={vDesc} className={className} />
                  </Fragment>
                );
              });

            // Entire attribute added
            if (oldValues.length === 0) {
              return (
                <div key={d.key}>
                  <AttrNameHover name={name} description={attrDesc} className="font-medium text-muted-foreground" />{" "}
                  <span className="text-green-600">
                    {renderValues(newValues, curDesc)}
                  </span>
                  <span className="text-muted-foreground/60 italic ml-1">
                    (added)
                  </span>
                </div>
              );
            }

            // Entire attribute removed
            if (newValues.length === 0) {
              return (
                <div key={d.key}>
                  <AttrNameHover name={name} description={attrDesc} className="font-medium text-muted-foreground" />{" "}
                  <span className="text-red-500 line-through">
                    {renderValues(oldValues, targetDesc)}
                  </span>
                  <span className="text-muted-foreground/60 italic ml-1">
                    (removed)
                  </span>
                </div>
              );
            }

            // Multi-select with some kept: show +/- format
            if (d.kept.length > 0) {
              return (
                <div key={d.key}>
                  <AttrNameHover name={name} description={attrDesc} className="font-medium text-muted-foreground" />{" "}
                  {d.added.map((v) => {
                    const vLabel = resolveLabel(d.key, v, curDesc);
                    const vDesc = curDesc?.[d.key]?.values[v]?.description;
                    return (
                      <span key={v} className="text-green-600 mr-1">
                        + <ValueHover label={vLabel} description={vDesc} />
                      </span>
                    );
                  })}
                  {d.removed.map((v) => {
                    const vLabel = resolveLabel(d.key, v, targetDesc);
                    const vDesc = targetDesc?.[d.key]?.values[v]?.description;
                    return (
                      <span key={v} className="text-red-500 mr-1">
                        &minus; <ValueHover label={vLabel} description={vDesc} />
                      </span>
                    );
                  })}
                </div>
              );
            }

            // Full replacement: old → new
            return (
              <div key={d.key}>
                <AttrNameHover name={name} description={attrDesc} className="font-medium text-muted-foreground" />{" "}
                <span className="text-muted-foreground">
                  {renderValues(oldValues, targetDesc)}
                </span>
                {" → "}
                <span>
                  {renderValues(newValues, curDesc)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Attribute context changes */}
      {contextDiffs.length > 0 && (
        <div className="space-y-0.5">
          <span className="font-medium text-muted-foreground">
            Attribute context:
          </span>
          {contextDiffs.map((d) => (
            <div key={d.key} className="ml-2">
              <AttrNameHover
                name={d.name}
                description={d.newDesc ?? d.oldDesc ?? undefined}
                className="font-medium text-muted-foreground"
              />{" "}
              {d.oldDesc == null ? (
                <span className="text-green-600 line-clamp-1">
                  &ldquo;{d.newDesc}&rdquo;
                  <span className="italic ml-1">(added)</span>
                </span>
              ) : d.newDesc == null ? (
                <span className="text-red-500">
                  <span className="line-through line-clamp-1">
                    &ldquo;{d.oldDesc}&rdquo;
                  </span>
                  <span className="italic ml-1">(removed)</span>
                </span>
              ) : (
                <>
                  <span className="text-muted-foreground line-clamp-1">
                    &ldquo;{d.oldDesc}&rdquo;
                  </span>
                  {" → "}
                  <span className="line-clamp-1">
                    &ldquo;{d.newDesc}&rdquo;
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* System prompt */}
      {sysPromptChanged && (
        <div>
          <span className="font-medium text-muted-foreground">
            System prompt:{" "}
          </span>
          <button
            onClick={() => setSysPromptExpanded((e) => !e)}
            className="text-muted-foreground/60 italic underline underline-offset-2 hover:text-foreground"
          >
            {sysPromptExpanded ? "hide" : "changed"}
          </button>
          {sysPromptExpanded && (
            <div className="mt-1 space-y-1">
              <div className="whitespace-pre-wrap text-muted-foreground border rounded-md p-2 bg-muted/30 text-[11px] max-h-40 overflow-y-auto">
                {target.prompt}
              </div>
              <div className="whitespace-pre-wrap border rounded-md p-2 bg-muted/30 text-[11px] max-h-40 overflow-y-auto">
                {current.prompt}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Model */}
      {modelChanged && (
        <div>
          <span className="font-medium text-muted-foreground">Model: </span>
          <span className="text-muted-foreground mr-1">
            {getModelLabel(target.model)}
          </span>
          → <span>{getModelLabel(current.model)}</span>
        </div>
      )}

      {/* Image count */}
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

      {/* Job type */}
      {jobTypeChanged && (
        <div>
          <span className="font-medium text-muted-foreground">Type: </span>
          <span className="text-muted-foreground mr-1">
            {target.jobType}
          </span>
          → <span>{current.jobType}</span>
        </div>
      )}

      {/* Include layers */}
      {includeLayersChanged && (
        <div>
          <span className="font-medium text-muted-foreground">
            Layers baked in:{" "}
          </span>
          <span className="text-muted-foreground mr-1">
            {target.includeLayers ? "yes" : "no"}
          </span>
          → <span>{current.includeLayers ? "yes" : "no"}</span>
        </div>
      )}

      {/* Text layers */}
      {textLayersChanged && (
        <div>
          <span className="font-medium text-muted-foreground">Layers: </span>
          {(prevLayers ?? []).length > 0 && (
            <span className="text-muted-foreground mr-1">
              {(prevLayers ?? [])
                .map((l) => {
                  const label = `"${l.text || l.name}"`;
                  const vis = l.visible === false ? " hidden" : "";
                  return l.type ? `${label} (${l.type}${vis})` : label;
                })
                .join(", ")}
            </span>
          )}
          {(curTextLayers ?? []).length > 0 && (
            <>
              {(prevLayers ?? []).length > 0 && "→ "}
              <span>
                {(curTextLayers ?? [])
                  .map((l) => {
                    const label = `"${l.text || l.name}"`;
                    const vis = l.visible === false ? " hidden" : "";
                    return l.type ? `${label} (${l.type}${vis})` : label;
                  })
                  .join(", ")}
              </span>
            </>
          )}
        </div>
      )}

      {/* No changes */}
      {hasNoChanges && (
        <div className="text-muted-foreground/60 italic">No changes</div>
      )}
    </div>
  );
}
