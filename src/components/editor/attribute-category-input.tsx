"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AttributeCategory } from "@/lib/attributes";

interface AttributeCategoryInputProps {
  category: AttributeCategory;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onAddCustomValue?: (value: string, label: string) => void;
  onRemoveCustomValue?: (value: string) => void;
}

export function AttributeCategoryInput({
  category,
  value,
  onChange,
  onAddCustomValue,
  onRemoveCustomValue,
}: AttributeCategoryInputProps) {
  if (category.type === "text") {
    return (
      <div className="space-y-1.5">
        <Label>{category.name}</Label>
        <Textarea
          rows={3}
          placeholder={`Enter ${category.name.toLowerCase()}...`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (category.type === "single") {
    return (
      <SingleSelect
        category={category}
        value={value as string}
        onChange={(v) => onChange(v)}
        onAddCustomValue={onAddCustomValue}
      />
    );
  }

  return (
    <MultiSelect
      category={category}
      value={value as string[]}
      onChange={(v) => onChange(v)}
      onAddCustomValue={onAddCustomValue}
      onRemoveCustomValue={onRemoveCustomValue}
    />
  );
}

function SingleSelect({
  category,
  value,
  onChange,
  onAddCustomValue,
}: {
  category: AttributeCategory;
  value: string;
  onChange: (value: string) => void;
  onAddCustomValue?: (value: string, label: string) => void;
}) {
  const options = category.values.map((v) => ({
    value: v.value,
    label: v.label,
  }));

  return (
    <div className="space-y-1.5">
      <Label>{category.name}</Label>
      <Combobox
        options={options}
        value={value}
        onChange={onChange}
        placeholder={`Select ${category.name.toLowerCase()}...`}
        onCreateOption={
          onAddCustomValue
            ? (label) => {
                const slug = label
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "");
                onAddCustomValue(slug, label);
                onChange(slug);
              }
            : undefined
        }
      />
    </div>
  );
}

function MultiSelect({
  category,
  value,
  onChange,
  onAddCustomValue,
  onRemoveCustomValue,
}: {
  category: AttributeCategory;
  value: string[];
  onChange: (value: string[]) => void;
  onAddCustomValue?: (value: string, label: string) => void;
  onRemoveCustomValue?: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [customInput, setCustomInput] = useState("");

  function toggle(val: string) {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  }

  function addCustom() {
    const label = customInput.trim();
    if (!label) return;
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (category.values.some((v) => v.value === slug)) {
      // Already exists, just select it
      if (!value.includes(slug)) {
        onChange([...value, slug]);
      }
    } else {
      onAddCustomValue?.(slug, label);
      onChange([...value, slug]);
    }
    setCustomInput("");
    setAdding(false);
  }

  return (
    <div className="space-y-1.5">
      <Label>{category.name}</Label>
      <div className="flex flex-wrap gap-1.5">
        {category.values.map((v) => (
          <Badge
            key={v.value}
            variant={value.includes(v.value) ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => toggle(v.value)}
          >
            {v.label}
            {!v.builtIn && onRemoveCustomValue && (
              <button
                type="button"
                className="ml-1 rounded-full hover:bg-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((val) => val !== v.value));
                  onRemoveCustomValue(v.value);
                }}
              >
                <XIcon className="size-2.5" />
              </button>
            )}
          </Badge>
        ))}
        {adding ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              addCustom();
            }}
          >
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="h-6 w-24 text-xs"
              placeholder="Custom..."
              autoFocus
              onBlur={() => {
                if (!customInput.trim()) setAdding(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAdding(false);
              }}
            />
          </form>
        ) : (
          <Badge
            variant="outline"
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setAdding(true)}
          >
            <PlusIcon className="mr-0.5 size-3" />
            Add
          </Badge>
        )}
      </div>
    </div>
  );
}
