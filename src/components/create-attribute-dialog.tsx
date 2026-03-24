"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  slugify,
  getDefaultValue,
  deduplicateValues,
  type Attribute,
  type AttributeValue,
} from "@/lib/attributes";

const ATTRIBUTE_TYPES = [
  "single",
  "multi",
  "text",
  "toggle",
  "scale",
  "color",
  "palette",
] as const;

const TYPE_LABELS: Record<Attribute["type"], string> = {
  single: "Single Select",
  multi: "Multi Select",
  text: "Text",
  toggle: "Toggle",
  scale: "Scale",
  color: "Color",
  palette: "Palette",
};

const DEFAULT_VALUE_COLORS = ["#6366f1", "#ec4899", "#f59e0b"];

interface ValueEntry {
  label: string;
  description: string;
  colors: string[];
}

interface CreateAttributeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingAttributeIds: string[];
  onCreateAttribute: (
    attribute: Attribute,
    defaultValue: string | string[],
  ) => void;
}

export function CreateAttributeDialog({
  open,
  onOpenChange,
  existingAttributeIds,
  onCreateAttribute,
}: CreateAttributeDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Attribute["type"]>("single");
  const [description, setDescription] = useState("");
  const [values, setValues] = useState<ValueEntry[]>([
    { label: "", description: "", colors: [...DEFAULT_VALUE_COLORS] },
  ]);
  const [scaleMinLabel, setScaleMinLabel] = useState("");
  const [scaleMaxLabel, setScaleMaxLabel] = useState("");
  const [duplicateError, setDuplicateError] = useState("");

  const hasValues = type === "single" || type === "multi" || type === "palette";
  const nonEmptyValues = values.filter((v) => v.label.trim() !== "");
  const canCreate =
    name.trim() !== "" && !duplicateError && (!hasValues || nonEmptyValues.length > 0);

  function reset() {
    setName("");
    setType("single");
    setDescription("");
    setValues([{ label: "", description: "", colors: [...DEFAULT_VALUE_COLORS] }]);
    setScaleMinLabel("");
    setScaleMaxLabel("");
    setDuplicateError("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (duplicateError) {
      const id = slugify(value.trim());
      if (!existingAttributeIds.includes(id)) {
        setDuplicateError("");
      }
    }
  }

  function handleNameBlur() {
    const id = slugify(name.trim());
    if (id && existingAttributeIds.includes(id)) {
      setDuplicateError(`An attribute named "${name.trim()}" already exists`);
    }
  }

  function addValueRow() {
    setValues([...values, { label: "", description: "", colors: [...DEFAULT_VALUE_COLORS] }]);
  }

  function updateValue(index: number, field: "label" | "description", val: string) {
    setValues(values.map((v, i) => (i === index ? { ...v, [field]: val } : v)));
  }

  function updateValueColor(index: number, colorIndex: number, color: string) {
    setValues(values.map((v, i) =>
      i === index
        ? { ...v, colors: v.colors.map((c, ci) => (ci === colorIndex ? color : c)) }
        : v,
    ));
  }

  function addValueColor(index: number) {
    setValues(values.map((v, i) =>
      i === index && v.colors.length < 6
        ? { ...v, colors: [...v.colors, "#888888"] }
        : v,
    ));
  }

  function removeValueColor(valueIndex: number, colorIndex: number) {
    setValues(values.map((v, i) =>
      i === valueIndex && v.colors.length > 3
        ? { ...v, colors: v.colors.filter((_, ci) => ci !== colorIndex) }
        : v,
    ));
  }

  function removeValue(index: number) {
    if (values.length <= 1) return;
    setValues(values.filter((_, i) => i !== index));
  }

  function handleCreate() {
    if (!canCreate) return;

    const id = slugify(name.trim());
    if (existingAttributeIds.includes(id)) {
      setDuplicateError(`An attribute named "${name.trim()}" already exists`);
      return;
    }

    const attributeValues: AttributeValue[] = hasValues
      ? deduplicateValues(
          nonEmptyValues.map((v) => ({
            value: slugify(v.label.trim()),
            label: v.label.trim(),
            builtIn: false,
            description: v.description.trim() || undefined,
            ...(type === "palette" && v.colors.length > 0
              ? { colors: v.colors }
              : {}),
          })),
        )
      : [];

    const attribute: Attribute = {
      id,
      name: name.trim(),
      type,
      builtIn: false,
      enabled: true,
      description: description.trim() || undefined,
      values: attributeValues,
      ...(type === "scale" &&
        scaleMinLabel.trim() &&
        scaleMaxLabel.trim() && {
          scaleLabels: {
            min: scaleMinLabel.trim(),
            max: scaleMaxLabel.trim(),
          },
        }),
    };

    onCreateAttribute(attribute, getDefaultValue(type, attributeValues[0]?.value));
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Attribute</DialogTitle>
          <DialogDescription>
            Add a custom attribute to customize your cover generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="attr-name">Name</Label>
            <Input
              id="attr-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="e.g. Color Palette, Era, Texture"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            {duplicateError && (
              <p className="text-xs text-destructive">{duplicateError}</p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {ATTRIBUTE_TYPES.map((t) => (
                <Button
                  key={t}
                  variant={type === t ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setType(t)}
                >
                  {TYPE_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="attr-desc">Description (optional)</Label>
            <Textarea
              id="attr-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How this attribute influences cover generation..."
              className="text-sm"
            />
          </div>

          {/* Scale labels */}
          {type === "scale" && (
            <div className="space-y-1.5">
              <Label>Scale Labels (optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={scaleMinLabel}
                  onChange={(e) => setScaleMinLabel(e.target.value)}
                  placeholder="Min (e.g. Realistic)"
                  className="text-sm"
                />
                <Input
                  value={scaleMaxLabel}
                  onChange={(e) => setScaleMaxLabel(e.target.value)}
                  placeholder="Max (e.g. Illustrated)"
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {/* Values for single/multi */}
          {hasValues && (
            <div className="space-y-2">
              <Label>
                Values{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (at least 1 required)
                </span>
              </Label>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {values.map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Input
                        value={v.label}
                        onChange={(e) => updateValue(i, "label", e.target.value)}
                        placeholder="Value label"
                        className="h-8 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addValueRow();
                          }
                        }}
                      />
                      <Input
                        value={v.description}
                        onChange={(e) =>
                          updateValue(i, "description", e.target.value)
                        }
                        placeholder="Description (optional)"
                        className="h-7 text-xs text-muted-foreground"
                      />
                      {type === "palette" && (
                        <div className="flex items-center gap-1">
                          {v.colors.map((color, ci) => (
                            <div key={ci} className="group/color relative">
                              <label
                                className="block size-5 cursor-pointer rounded-full border border-border shadow-sm"
                                style={{ backgroundColor: color }}
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onChange={(e) => updateValueColor(i, ci, e.target.value)}
                                  className="sr-only"
                                />
                              </label>
                              {v.colors.length > 3 && (
                                <button
                                  type="button"
                                  className="absolute -top-1 -right-1 hidden size-3 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover/color:flex"
                                  onClick={() => removeValueColor(i, ci)}
                                >
                                  <XIcon className="size-1.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          {v.colors.length < 6 && (
                            <button
                              type="button"
                              className="flex size-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground"
                              onClick={() => addValueColor(i)}
                            >
                              <PlusIcon className="size-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeValue(i)}
                      disabled={values.length <= 1}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={addValueRow}
              >
                <PlusIcon className="size-3" />
                Add Value
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            Create Attribute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
