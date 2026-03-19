"use client";

import { useState, useRef, useCallback } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_TEXTAREA_HEIGHT = 96;
const MIN_COLORS = 3;
const MAX_COLORS = 6;
const DEFAULT_COLORS = ["#6366f1", "#ec4899", "#f59e0b"];

interface AddPalettePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (label: string, description?: string, colors?: string[]) => void;
  children: React.ReactNode;
}

export function AddPalettePopover({
  open,
  onOpenChange,
  onAdd,
  children,
}: AddPalettePopoverProps) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const anchorRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setLabel("");
    setDescription("");
    setColors([...DEFAULT_COLORS]);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const autoGrow = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const clamped = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${clamped}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  function updateColor(index: number, value: string): void {
    setColors(colors.map((c, i) => (i === index ? value : c)));
  }

  function addColor(): void {
    if (colors.length < MAX_COLORS) {
      setColors([...colors, "#888888"]);
    }
  }

  function removeColor(index: number): void {
    if (colors.length <= MIN_COLORS) return;
    setColors(colors.filter((_, i) => i !== index));
  }

  function handleAdd(): void {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd(trimmed, description.trim() || undefined, colors);
    onOpenChange(false);
  }

  return (
    <>
      <div ref={anchorRef}>{children}</div>
      <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            anchor={anchorRef}
            side="bottom"
            sideOffset={4}
            align="start"
          >
            <PopoverPrimitive.Popup className="z-50 w-72 rounded-lg border bg-popover p-3 shadow-md">
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <Label htmlFor="pp-label">Name</Label>
                  <Input
                    id="pp-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Palette name..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        descRef.current?.focus();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Colors</Label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {colors.map((color, i) => (
                      <div key={i} className="group/color relative">
                        <label
                          className="block size-7 cursor-pointer rounded-full border border-border shadow-sm"
                          style={{ backgroundColor: color }}
                        >
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => updateColor(i, e.target.value)}
                            className="sr-only"
                          />
                        </label>
                        {colors.length > MIN_COLORS && (
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 hidden size-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover/color:flex"
                            onClick={() => removeColor(i)}
                          >
                            <XIcon className="size-2" />
                          </button>
                        )}
                      </div>
                    ))}
                    {colors.length < MAX_COLORS && (
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground"
                        onClick={addColor}
                      >
                        <PlusIcon className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pp-desc">
                    Description{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <textarea
                    ref={descRef}
                    id="pp-desc"
                    rows={1}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      autoGrow(e.target);
                    }}
                    placeholder="When to use this palette..."
                    className="flex w-full resize-none overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleAdd}
                  disabled={!label.trim()}
                >
                  Add
                </Button>
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
