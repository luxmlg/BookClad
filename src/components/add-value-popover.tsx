"use client";

import { useState, useRef, useCallback } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_TEXTAREA_HEIGHT = 96; // ~4 rows

interface AddValuePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLabel?: string;
  onAdd: (label: string, description?: string) => void;
  children: React.ReactNode;
}

export function AddValuePopover({
  open,
  onOpenChange,
  initialLabel = "",
  onAdd,
  children,
}: AddValuePopoverProps) {
  const [label, setLabel] = useState(initialLabel);
  const [description, setDescription] = useState("");
  const anchorRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Reset form state when popover opens (render-time adjustment, not an effect)
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setLabel(initialLabel);
    setDescription("");
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const autoGrow = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const clamped = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${clamped}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  function handleAdd(): void {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd(trimmed, description.trim() || undefined);
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
            <PopoverPrimitive.Popup className="z-50 w-70 rounded-lg border bg-popover p-3 shadow-md">
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <Label htmlFor="pv-label">Name</Label>
                  <Input
                    id="pv-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Value name..."
                    autoFocus={!initialLabel}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        descRef.current?.focus();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pv-desc">
                    Description{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <textarea
                    ref={descRef}
                    id="pv-desc"
                    rows={1}
                    value={description}
                    autoFocus={!!initialLabel}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      autoGrow(e.target);
                    }}
                    placeholder="How this value affects the cover..."
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
