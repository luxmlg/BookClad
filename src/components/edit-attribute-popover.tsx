"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_TEXTAREA_HEIGHT = 96; // ~4 rows

interface EditPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string;
  nameDisabled?: boolean;
  onSave: (name: string, description: string) => void;
  children: React.ReactNode;
}

export function EditPopover({
  open,
  onOpenChange,
  name: initialName,
  description: initialDescription,
  nameDisabled = false,
  onSave,
  children,
}: EditPopoverProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const anchorRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const clamped = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${clamped}px`;
    el.style.overflowY =
      el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  // Reset form state when popover opens (render-time adjustment, not an effect)
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setName(initialName);
    setDescription(initialDescription);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  // DOM adjustments after popover opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        if (descRef.current) {
          autoGrow(descRef.current);
          const len = descRef.current.value.length;
          descRef.current.setSelectionRange(len, len);
        }
      });
    }
  }, [open, autoGrow]);

  function handleSave(): void {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave(trimmedName, description.trim());
    onOpenChange(false);
  }

  const nameChanged = name.trim() !== initialName;
  const descChanged = (description.trim() || "") !== (initialDescription || "");
  const hasChanges = nameChanged || descChanged;

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
                  <Label htmlFor="ep-name">Name</Label>
                  <Input
                    id="ep-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={nameDisabled}
                    autoFocus={!nameDisabled}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        descRef.current?.focus();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ep-desc">
                    Description{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <textarea
                    ref={descRef}
                    id="ep-desc"
                    rows={1}
                    value={description}
                    autoFocus={nameDisabled}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      autoGrow(e.target);
                    }}
                    placeholder="How this affects the cover..."
                    className="flex w-full resize-none overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleSave}
                  disabled={!name.trim() || !hasChanges}
                >
                  Save
                </Button>
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
