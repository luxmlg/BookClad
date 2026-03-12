"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, PlusIcon } from "lucide-react";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  onCreateOption?: (label: string) => void;
  placeholder?: string;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  onCreateOption,
  placeholder = "Select...",
  className,
}: ComboboxProps) {
  const [inputValue, setInputValue] = React.useState("");

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const showCreate =
    onCreateOption &&
    inputValue.trim() !== "" &&
    inputValue.trim() !== selectedLabel &&
    !options.some(
      (o) => o.label.toLowerCase() === inputValue.trim().toLowerCase()
    );

  return (
    <ComboboxPrimitive.Root
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
      onInputValueChange={setInputValue}
      itemToStringLabel={(optionValue) => {
        const opt = options.find((o) => o.value === optionValue);
        return opt ? opt.label : String(optionValue);
      }}
      filteredItems={filtered.map((o) => o.value)}
    >
      <div className={cn("relative", className)}>
        <ComboboxPrimitive.Input
          placeholder={placeholder}
          className="flex h-8 w-full rounded-lg border border-input bg-transparent py-2 pr-8 pl-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <ComboboxPrimitive.Trigger className="absolute inset-y-0 right-0 flex items-center pr-2">
          <ComboboxPrimitive.Icon>
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </ComboboxPrimitive.Icon>
        </ComboboxPrimitive.Trigger>
      </div>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          side="bottom"
          sideOffset={4}
          className="z-50"
        >
          <ComboboxPrimitive.Popup className="max-h-60 w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <ComboboxPrimitive.List>
              {filtered.map((option) => (
                <ComboboxPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  {option.label}
                  <ComboboxPrimitive.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              ))}
            </ComboboxPrimitive.List>
            <ComboboxPrimitive.Empty className="py-2 text-center text-sm text-muted-foreground">
              {showCreate ? null : "No results"}
            </ComboboxPrimitive.Empty>
            {showCreate && (
              <button
                type="button"
                className="flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary outline-hidden hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCreateOption(inputValue.trim());
                  setInputValue("");
                }}
              >
                <PlusIcon className="size-3.5" />
                Create &quot;{inputValue.trim()}&quot;
              </button>
            )}
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
