"use client";

import { useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CaseSensitive,
  Minus,
  Plus,
  Upload,
  Space,
} from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
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
import { SelectWithAction } from "@/components/ui/select-with-action";
import { FONTS_BY_CATEGORY } from "@/lib/fonts";
import type { TextNodeConfig } from "./cover-canvas";
import type { CustomFont } from "./editor-shell";

interface TextFloatingToolbarProps {
  node: TextNodeConfig;
  onUpdate: (attrs: Partial<TextNodeConfig>) => void;
  customFonts: CustomFont[];
  onFontUpload: (file: File) => void;
}

function toggleFontStyleFlag(current: string, flag: string): string {
  if (current.includes(flag)) {
    return current.replace(flag, "").trim() || "normal";
  }
  return (current + " " + flag).trim();
}

function toggleDecoration(current: string | undefined, flag: string): string {
  const val = current ?? "";
  if (val.includes(flag)) {
    return val.replace(flag, "").trim();
  }
  return (val + " " + flag).trim();
}

export function TextFloatingToolbar({
  node,
  onUpdate,
  customFonts,
  onFontUpload,
}: TextFloatingToolbarProps) {
  const fontInputRef = useRef<HTMLInputElement>(null);
  const spacingAnchorRef = useRef<HTMLButtonElement>(null);

  const isBold = node.fontStyle.includes("bold");
  const isItalic = node.fontStyle.includes("italic");
  const isUnderline = (node.textDecoration ?? "").includes("underline");
  const isLineThrough = (node.textDecoration ?? "").includes("line-through");
  const textTransform = node.textTransform ?? "none";

  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-popover px-1.5 py-1 shadow-md">
      {/* Font family */}
      <div className="w-36">
        <SelectWithAction
          icon={<Upload className="size-3" />}
          onClick={() => fontInputRef.current?.click()}
          title="Upload custom font"
        >
          <Select
            value={node.fontFamily}
            onValueChange={(v) => v && onUpdate({ fontFamily: v })}
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {customFonts.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Custom</SelectLabel>
                  {customFonts.map((f) => (
                    <SelectItem key={`custom-${f.family}`} value={f.family}>
                      <span style={{ fontFamily: f.family }}>{f.family}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
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
        </SelectWithAction>
        <input
          ref={fontInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFontUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      <Separator />

      {/* Font size stepper */}
      <div className="flex items-center gap-0">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onUpdate({ fontSize: Math.max(8, node.fontSize - 2) })}
        >
          <Minus className="size-3" />
        </Button>
        <input
          type="number"
          value={Math.round(node.fontSize)}
          onChange={(e) => onUpdate({ fontSize: Number(e.target.value) || 32 })}
          className="w-8 bg-transparent text-center text-xs outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          min={8}
          max={300}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onUpdate({ fontSize: Math.min(300, node.fontSize + 2) })}
        >
          <Plus className="size-3" />
        </Button>
      </div>

      <Separator />

      {/* Bold / Italic / Underline / Strikethrough */}
      <Button
        variant={isBold ? "default" : "ghost"}
        size="icon-xs"
        onClick={() => onUpdate({ fontStyle: toggleFontStyleFlag(node.fontStyle, "bold") })}
      >
        <Bold className="size-3" />
      </Button>
      <Button
        variant={isItalic ? "default" : "ghost"}
        size="icon-xs"
        onClick={() => onUpdate({ fontStyle: toggleFontStyleFlag(node.fontStyle, "italic") })}
      >
        <Italic className="size-3" />
      </Button>
      <Button
        variant={isUnderline ? "default" : "ghost"}
        size="icon-xs"
        onClick={() => onUpdate({ textDecoration: toggleDecoration(node.textDecoration, "underline") })}
      >
        <Underline className="size-3" />
      </Button>
      <Button
        variant={isLineThrough ? "default" : "ghost"}
        size="icon-xs"
        onClick={() => onUpdate({ textDecoration: toggleDecoration(node.textDecoration, "line-through") })}
      >
        <Strikethrough className="size-3" />
      </Button>

      <Separator />

      {/* Text transform (case) */}
      <Button
        variant={textTransform !== "none" ? "default" : "ghost"}
        size="icon-xs"
        title={textTransform === "uppercase" ? "Uppercase" : textTransform === "lowercase" ? "Lowercase" : "Normal case"}
        onClick={() => {
          const next = textTransform === "none" ? "uppercase" : textTransform === "uppercase" ? "lowercase" : "none";
          onUpdate({ textTransform: next });
        }}
      >
        <CaseSensitive className="size-3" />
      </Button>

      <Separator />

      {/* Color */}
      <input
        type="color"
        value={node.fill.startsWith("rgba") ? "#ffffff" : node.fill}
        onChange={(e) => onUpdate({ fill: e.target.value })}
        className="h-6 w-6 cursor-pointer rounded border p-0.5"
        title="Text color"
      />

      <Separator />

      {/* Alignment */}
      <Button
        variant={node.align === "left" ? "default" : "ghost"}
        size="icon-xs"
        onClick={() => onUpdate({ align: "left" })}
      >
        <AlignLeft className="size-3" />
      </Button>
      <Button
        variant={node.align === "center" ? "default" : "ghost"}
        size="icon-xs"
        onClick={() => onUpdate({ align: "center" })}
      >
        <AlignCenter className="size-3" />
      </Button>
      <Button
        variant={node.align === "right" ? "default" : "ghost"}
        size="icon-xs"
        onClick={() => onUpdate({ align: "right" })}
      >
        <AlignRight className="size-3" />
      </Button>

      <Separator />

      {/* Spacing popover */}
      <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger
          ref={spacingAnchorRef}
          className="inline-flex items-center justify-center rounded-[min(var(--radius-md),10px)] text-sm font-medium outline-none select-none size-6 hover:bg-muted hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3"
          title="Spacing"
        >
          <Space className="size-3" />
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner side="bottom" sideOffset={8} align="end">
            <PopoverPrimitive.Popup className="z-50 w-56 rounded-lg border bg-popover p-3 shadow-md">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Letter spacing</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[node.letterSpacing ?? 0]}
                      onValueChange={(v) => onUpdate({ letterSpacing: Array.isArray(v) ? v[0] : v })}
                      min={0}
                      max={50}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={Math.round(node.letterSpacing ?? 0)}
                      onChange={(e) => onUpdate({ letterSpacing: Number(e.target.value) || 0 })}
                      className="h-7 w-14 text-xs"
                      min={0}
                      max={200}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Line spacing</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[node.lineHeight ?? 1]}
                      onValueChange={(v) => onUpdate({ lineHeight: Array.isArray(v) ? v[0] : v })}
                      min={0.5}
                      max={3}
                      step={0.1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={node.lineHeight ?? 1}
                      onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) || 1 })}
                      className="h-7 w-14 text-xs"
                      min={0.5}
                      max={5}
                      step={0.1}
                    />
                  </div>
                </div>
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

function Separator() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}
