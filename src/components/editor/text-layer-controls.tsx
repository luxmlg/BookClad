"use client";

import { useState } from "react";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronRight,
  Trash2,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TextNodeConfig } from "./cover-canvas";
import { FONTS_BY_CATEGORY } from "@/lib/fonts";

interface TextLayerControlsProps {
  node: TextNodeConfig;
  onUpdate: (attrs: Partial<TextNodeConfig>) => void;
  onRemove?: () => void;
}

export function TextLayerControls({ node, onUpdate, onRemove }: TextLayerControlsProps) {
  const [effectsOpen, setEffectsOpen] = useState(false);
  const hasShadow = (node.shadowBlur ?? 0) > 0;
  const hasOutline = (node.strokeWidth ?? 0) > 0;

  return (
    <div className="space-y-2">
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
      <Input
        value={node.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        placeholder="Text content"
      />
      <div className="space-y-1">
        <Label className="text-sm">Font</Label>
        <Select
          value={node.fontFamily}
          onValueChange={(v) => v && onUpdate({ fontFamily: v })}
        >
          <SelectTrigger className="w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS_BY_CATEGORY.map((group) => (
              <SelectGroup key={group.category}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.fonts.map((f) => (
                  <SelectItem key={f.family} value={f.family}>
                    <span style={{ fontFamily: f.family }}>{f.family}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-sm">Size</Label>
          <Input
            type="number"
            value={Math.round(node.fontSize)}
            onChange={(e) =>
              onUpdate({ fontSize: Number(e.target.value) || 32 })
            }
            min={12}
            max={300}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm flex items-center gap-1">
            <RotateCw className="size-3" /> Rotation
          </Label>
          <Input
            type="number"
            value={Math.round(node.rotation ?? 0)}
            onChange={(e) =>
              onUpdate({ rotation: Number(e.target.value) || 0 })
            }
            min={-360}
            max={360}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="space-y-1">
          <Label className="text-sm">Color</Label>
          <Input
            type="color"
            value={node.fill.startsWith("rgba") ? "#ffffff" : node.fill}
            onChange={(e) => onUpdate({ fill: e.target.value })}
            className="h-8 w-12 p-0.5"
          />
        </div>
        <div className="flex gap-1 pt-4">
          <Button
            variant={node.fontStyle.includes("bold") ? "default" : "outline"}
            size="icon-sm"
            onClick={() =>
              onUpdate({
                fontStyle: node.fontStyle.includes("bold")
                  ? node.fontStyle.replace("bold", "").trim() || "normal"
                  : (node.fontStyle + " bold").trim(),
              })
            }
          >
            <Bold className="size-3" />
          </Button>
          <Button
            variant={node.fontStyle.includes("italic") ? "default" : "outline"}
            size="icon-sm"
            onClick={() =>
              onUpdate({
                fontStyle: node.fontStyle.includes("italic")
                  ? node.fontStyle.replace("italic", "").trim() || "normal"
                  : (node.fontStyle + " italic").trim(),
              })
            }
          >
            <Italic className="size-3" />
          </Button>
          <Button
            variant={node.align === "left" ? "default" : "outline"}
            size="icon-sm"
            onClick={() => onUpdate({ align: "left" })}
          >
            <AlignLeft className="size-3" />
          </Button>
          <Button
            variant={node.align === "center" ? "default" : "outline"}
            size="icon-sm"
            onClick={() => onUpdate({ align: "center" })}
          >
            <AlignCenter className="size-3" />
          </Button>
          <Button
            variant={node.align === "right" ? "default" : "outline"}
            size="icon-sm"
            onClick={() => onUpdate({ align: "right" })}
          >
            <AlignRight className="size-3" />
          </Button>
        </div>
      </div>

      {/* Effects section */}
      <Collapsible open={effectsOpen} onOpenChange={setEffectsOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
          <ChevronRight className={`size-3 transition-transform duration-200 ${effectsOpen ? "rotate-90" : ""}`} />
          Effects
          {(hasShadow || hasOutline) && (
            <span className="ml-auto text-xs text-primary">active</span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 pt-2 pl-1">
            {/* Shadow */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Shadow</Label>
                <Button
                  variant={hasShadow ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    onUpdate({
                      shadowBlur: hasShadow ? 0 : 4,
                      shadowColor: node.shadowColor || "#000000",
                    })
                  }
                >
                  {hasShadow ? "On" : "Off"}
                </Button>
              </div>
              {hasShadow && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-10 shrink-0">Color</Label>
                    <Input
                      type="color"
                      value={node.shadowColor || "#000000"}
                      onChange={(e) => onUpdate({ shadowColor: e.target.value })}
                      className="h-6 w-10 p-0.5"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-10 shrink-0">Blur</Label>
                    <Slider
                      value={[node.shadowBlur ?? 0]}
                      onValueChange={(v) => onUpdate({ shadowBlur: Array.isArray(v) ? v[0] : v })}
                      min={0}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs w-5 text-right text-muted-foreground">
                      {node.shadowBlur ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-10 shrink-0">X</Label>
                    <Slider
                      value={[node.shadowOffsetX ?? 2]}
                      onValueChange={(v) => onUpdate({ shadowOffsetX: Array.isArray(v) ? v[0] : v })}
                      min={-20}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs w-5 text-right text-muted-foreground">
                      {node.shadowOffsetX ?? 2}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-10 shrink-0">Y</Label>
                    <Slider
                      value={[node.shadowOffsetY ?? 2]}
                      onValueChange={(v) => onUpdate({ shadowOffsetY: Array.isArray(v) ? v[0] : v })}
                      min={-20}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs w-5 text-right text-muted-foreground">
                      {node.shadowOffsetY ?? 2}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Outline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Outline</Label>
                <Button
                  variant={hasOutline ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    onUpdate({
                      strokeWidth: hasOutline ? 0 : 2,
                      stroke: node.stroke || "#000000",
                    })
                  }
                >
                  {hasOutline ? "On" : "Off"}
                </Button>
              </div>
              {hasOutline && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-10 shrink-0">Color</Label>
                    <Input
                      type="color"
                      value={node.stroke || "#000000"}
                      onChange={(e) => onUpdate({ stroke: e.target.value })}
                      className="h-6 w-10 p-0.5"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-10 shrink-0">Width</Label>
                    <Slider
                      value={[node.strokeWidth ?? 0]}
                      onValueChange={(v) => onUpdate({ strokeWidth: Array.isArray(v) ? v[0] : v })}
                      min={0}
                      max={10}
                      step={0.5}
                      className="flex-1"
                    />
                    <span className="text-xs w-5 text-right text-muted-foreground">
                      {node.strokeWidth ?? 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
