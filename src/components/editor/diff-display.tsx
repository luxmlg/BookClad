"use client";

import { computeAttributeDiff } from "@/lib/attributes";
import type { Generation } from "./types";
import { asAttributeSnapshot, asTextLayerSnapshot } from "./types";
import { getModelLabel } from "./generation-helpers";

interface DiffDisplayProps {
  current: Generation;
  target: Generation;
}

export function DiffDisplay({ current, target }: DiffDisplayProps) {
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

  const includeLayersChanged =
    current.includeLayers !== target.includeLayers;

  const prevLayers = asTextLayerSnapshot(target.textLayerSnapshot);
  const layerKey = (l: { name: string; text: string; type?: string; visible?: boolean }): string =>
    `${l.type ?? "text"}|${l.text || l.name}|${l.visible ?? true}`;
  const prevStr = (prevLayers ?? []).map(layerKey).join(",");
  const curStr = (curTextLayers ?? []).map(layerKey).join(",");
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
      {includeLayersChanged && (
        <div>
          <span className="font-medium text-muted-foreground">Layers baked in: </span>
          <span className="text-muted-foreground mr-1">
            {target.includeLayers ? "yes" : "no"}
          </span>
          → <span>{current.includeLayers ? "yes" : "no"}</span>
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
            Layers:{" "}
          </span>
          {(prevLayers ?? []).length > 0 && (
            <span className="text-muted-foreground mr-1">
              {(prevLayers ?? []).map((l) => {
                const label = `"${l.text || l.name}"`;
                const vis = l.visible === false ? " hidden" : "";
                return l.type ? `${label} (${l.type}${vis})` : label;
              }).join(", ")}
            </span>
          )}
          {(curTextLayers ?? []).length > 0 && (
            <>
              {(prevLayers ?? []).length > 0 && "→ "}
              <span>
                {(curTextLayers ?? []).map((l) => {
                  const label = `"${l.text || l.name}"`;
                  const vis = l.visible === false ? " hidden" : "";
                  return l.type ? `${label} (${l.type}${vis})` : label;
                }).join(", ")}
              </span>
            </>
          )}
        </div>
      )}
      {!promptChanged &&
        !modelChanged &&
        !attrDiff &&
        !imageCountChanged &&
        !jobTypeChanged &&
        !includeLayersChanged &&
        !textLayersChanged && (
          <div className="text-muted-foreground/60 italic">No changes</div>
        )}
    </div>
  );
}
