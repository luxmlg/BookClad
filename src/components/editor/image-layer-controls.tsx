"use client";

import { useState } from "react";
import {
  Trash2,
  RotateCw,
  LockIcon,
  UnlockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { ImageNodeConfig } from "./canvas-types";

interface ImageLayerControlsProps {
  node: ImageNodeConfig;
  onUpdate: (attrs: Partial<ImageNodeConfig>) => void;
  onRemove?: () => void;
  assetUrl?: string;
}

export function ImageLayerControls({ node, onUpdate, onRemove, assetUrl }: ImageLayerControlsProps) {
  const [aspectLocked, setAspectLocked] = useState(true);
  const aspectRatio = node.width / node.height;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <input
          value={node.name ?? ""}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Layer name"
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold uppercase tracking-wider text-muted-foreground outline-none border-b border-transparent focus:border-muted-foreground/40 py-0.5"
        />
        {onRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </Button>
        )}
      </div>

      {/* Thumbnail preview */}
      {assetUrl && (
        <div className="rounded border overflow-hidden bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl}
            alt="Asset preview"
            className="w-full h-24 object-contain"
          />
        </div>
      )}

      {/* Opacity */}
      <div className="space-y-1">
        <Label className="text-sm">Opacity</Label>
        <div className="flex items-center gap-2">
          <Slider
            value={[Math.round((node.opacity ?? 1) * 100)]}
            onValueChange={(v) => onUpdate({ opacity: (Array.isArray(v) ? v[0] : v) / 100 })}
            min={0}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-xs w-8 text-right text-muted-foreground">
            {Math.round((node.opacity ?? 1) * 100)}%
          </span>
        </div>
      </div>

      {/* Size */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Size</Label>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setAspectLocked(!aspectLocked)}
            className="text-muted-foreground"
            title={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          >
            {aspectLocked ? <LockIcon className="size-3" /> : <UnlockIcon className="size-3" />}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground">Width</Label>
            <Input
              type="number"
              value={Math.round(node.width)}
              onChange={(e) => {
                const w = Number(e.target.value) || node.width;
                if (aspectLocked) {
                  onUpdate({ width: w, height: Math.round(w / aspectRatio) });
                } else {
                  onUpdate({ width: w });
                }
              }}
              min={10}
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground">Height</Label>
            <Input
              type="number"
              value={Math.round(node.height)}
              onChange={(e) => {
                const h = Number(e.target.value) || node.height;
                if (aspectLocked) {
                  onUpdate({ height: h, width: Math.round(h * aspectRatio) });
                } else {
                  onUpdate({ height: h });
                }
              }}
              min={10}
            />
          </div>
        </div>
      </div>

      {/* Rotation */}
      <div className="space-y-1">
        <Label className="text-sm flex items-center gap-1">
          <RotateCw className="size-3" /> Rotation
        </Label>
        <Input
          type="number"
          value={Math.round(node.rotation ?? 0)}
          onChange={(e) => onUpdate({ rotation: Number(e.target.value) || 0 })}
          min={-360}
          max={360}
        />
      </div>

      {/* Position */}
      <div className="space-y-1">
        <Label className="text-sm">Position</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground">X</Label>
            <Input
              type="number"
              value={Math.round(node.x)}
              onChange={(e) => onUpdate({ x: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground">Y</Label>
            <Input
              type="number"
              value={Math.round(node.y)}
              onChange={(e) => onUpdate({ y: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
