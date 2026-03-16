"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  slugify,
  getDefaultValue,
  type Attribute,
} from "@/lib/attributes";

const ATTRIBUTE_TYPES = [
  "single",
  "multi",
  "text",
  "toggle",
  "scale",
  "color",
] as const;

interface AddAttributeFormProps {
  existingAttributeIds: string[];
  onAddAttribute: (
    attribute: Attribute,
    defaultValue: string | string[],
  ) => void;
}

export function AddAttributeForm({
  existingAttributeIds,
  onAddAttribute,
}: AddAttributeFormProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<Attribute["type"]>("single");
  const [scaleMinLabel, setScaleMinLabel] = useState("");
  const [scaleMaxLabel, setScaleMaxLabel] = useState("");
  const [duplicateError, setDuplicateError] = useState("");

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = slugify(trimmed);

    if (existingAttributeIds.includes(id)) {
      setDuplicateError(`An attribute named "${trimmed}" already exists`);
      return;
    }

    const newAttr: Attribute = {
      id,
      name: trimmed,
      type,
      builtIn: false,
      enabled: true,
      values: [],
      ...(type === "scale" &&
        scaleMinLabel.trim() &&
        scaleMaxLabel.trim() && {
          scaleLabels: {
            min: scaleMinLabel.trim(),
            max: scaleMaxLabel.trim(),
          },
        }),
    };

    onAddAttribute(newAttr, getDefaultValue(type));
    reset();
  }

  function reset() {
    setName("");
    setType("single");
    setScaleMinLabel("");
    setScaleMaxLabel("");
    setDuplicateError("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={() => setAdding(true)}
      >
        <PlusIcon className="size-3.5" />
        Add Attribute
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <Input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setDuplicateError("");
        }}
        placeholder="Attribute name..."
        className="h-7 text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") reset();
        }}
      />
      {duplicateError && (
        <p className="text-xs text-destructive">{duplicateError}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {ATTRIBUTE_TYPES.map((t) => (
          <Button
            key={t}
            variant={type === t ? "default" : "outline"}
            size="sm"
            className="h-6 text-xs"
            onClick={() => setType(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>
      {type === "scale" && (
        <div className="flex gap-2">
          <Input
            value={scaleMinLabel}
            onChange={(e) => setScaleMinLabel(e.target.value)}
            placeholder="Min label (e.g. Realistic)"
            className="h-7 text-xs"
          />
          <Input
            value={scaleMaxLabel}
            onChange={(e) => setScaleMaxLabel(e.target.value)}
            placeholder="Max label (e.g. Illustrated)"
            className="h-7 text-xs"
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="h-6 text-xs" onClick={handleAdd}>
          Add
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={reset}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
