"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookText, Palette, FileText, Rocket, Check, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AttributeInput } from "@/components/editor/attribute-input";
import { AttributePickerDialog } from "@/components/attribute-picker-dialog";
import { CreateAttributeDialog } from "@/components/create-attribute-dialog";
import type {
  Attribute,
  AttributeConfigJson,
  AttributeSelection,
} from "@/lib/attributes";
import {
  buildDefaultConfig,
  buildDefaultSelection,
  getDefaultValue,
  addValueToAttribute,
  removeValueFromAttribute,
  updateValueInAttribute,
  renameAttribute,
  updateAttributeDescription,
  formatAttrValue,
} from "@/lib/attributes";
import { AttributeContextMenu } from "@/components/attribute-context-menu";
import {
  getAttributeConfig,
  saveAttributeConfig,
  createProject,
  createGeneration,
  fireAndForget,
} from "@/lib/api";

const STEPS = [
  { label: "Book Info", icon: BookText },
  { label: "Attributes", icon: Palette },
  { label: "Details", icon: FileText },
  { label: "Generate", icon: Rocket },
];

export function BriefWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [attributeConfig, setAttributeConfig] = useState<AttributeConfigJson>(
    buildDefaultConfig()
  );
  const [attributes, setAttributes] = useState<AttributeSelection>({});
  const [imageCount, setImageCount] = useState(4);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Fetch user's attribute config
  useEffect(() => {
    async function init() {
      try {
        const config = await getAttributeConfig();
        setAttributeConfig(config);
        setAttributes(buildDefaultSelection(config));
      } catch {
        const def = buildDefaultConfig();
        setAttributes(buildDefaultSelection(def));
      }
    }
    init();
  }, []);

  // Active = attributes present in current selections
  const activeAttributes = attributeConfig.attributes.filter(
    (c) => c.id in attributes,
  );
  const selectionAttributes = activeAttributes.filter(
    (c) => c.type !== "text",
  );
  const textAttributes = activeAttributes.filter((c) => c.type === "text");

  // Available for picker = config attributes NOT in current selections
  const availableAttributes = attributeConfig.attributes.filter(
    (c) => !(c.id in attributes),
  );

  function addCustomValue(attributeId: string, value: string, label: string, description?: string) {
    const updated = addValueToAttribute(attributeConfig, attributeId, value, label, description);
    setAttributeConfig(updated);
    fireAndForget(saveAttributeConfig(updated));
  }

  function handlePickAttribute(attribute: Attribute) {
    setAttributes((prev) => ({
      ...prev,
      [attribute.id]: getDefaultValue(attribute.type, attribute.values[0]?.value),
    }));
  }

  function handleCreateAttribute(attribute: Attribute, defaultValue: string | string[]) {
    const updated: AttributeConfigJson = {
      ...attributeConfig,
      attributes: [...attributeConfig.attributes, attribute],
    };
    setAttributeConfig(updated);
    setAttributes((prev) => ({ ...prev, [attribute.id]: defaultValue }));
    fireAndForget(saveAttributeConfig(updated));

    const isText = attribute.type === "text";
    toast.success(
      isText
        ? `Created "${attribute.name}" — text attributes appear on the Details step`
        : `Created "${attribute.name}"`,
    );
  }

  function handleRenameAttribute(attributeId: string, newName: string) {
    const updated = renameAttribute(attributeConfig, attributeId, newName);
    setAttributeConfig(updated);
    fireAndForget(saveAttributeConfig(updated));
  }

  function handleUpdateDescription(attributeId: string, description: string) {
    const updated = updateAttributeDescription(attributeConfig, attributeId, description);
    setAttributeConfig(updated);
    fireAndForget(saveAttributeConfig(updated));
  }

  function handleUpdateValue(
    attributeId: string,
    valueId: string,
    updates: { label?: string; description?: string },
  ) {
    const updated = updateValueInAttribute(attributeConfig, attributeId, valueId, updates);
    setAttributeConfig(updated);
    fireAndForget(saveAttributeConfig(updated));
  }

  function handleRemoveValue(attributeId: string, valueId: string) {
    const updated = removeValueFromAttribute(attributeConfig, attributeId, valueId);
    setAttributeConfig(updated);
    fireAndForget(saveAttributeConfig(updated));
  }

  function removeFromWizard(attributeId: string) {
    setAttributes((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [attributeId]: _, ...rest } = prev;
      return rest;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Prepend subtitle to the first text attribute if present
      const projectAttrs = { ...attributes };
      if (subtitle && textAttributes.length > 0) {
        const firstTextId = textAttributes[0].id;
        const existing = (projectAttrs[firstTextId] as string) || "";
        projectAttrs[firstTextId] = [subtitle, existing]
          .filter(Boolean)
          .join(". ");
      }

      const project = await createProject({
        title,
        author,
        attributes: projectAttrs,
      });

      await createGeneration({ projectId: project.id, imageCount });

      toast.success("Cover generation started!");
      router.push(`/editor/${project.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setSubmitting(false);
    }
  }

  const canAdvance = () => {
    switch (step) {
      case 0:
        return title.trim() !== "" && author.trim() !== "";
      case 1: {
        // At least one selection attribute has a value
        return selectionAttributes.some((c) => {
          const val = attributes[c.id];
          if (c.type === "single") return typeof val === "string" && val !== "";
          return Array.isArray(val) && val.length > 0;
        });
      }
      default:
        return true;
    }
  };

  const progressValue = ((step + 1) / STEPS.length) * 100;

  return (
    <div>
      <Progress value={progressValue} className="mb-8 h-1.5" />

      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isDone
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`hidden h-px w-6 sm:block ${
                    i < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Book Information</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the basic details about your book.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">
                  Book Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Enter your book title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">
                  Author Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="author"
                  placeholder="Enter the author name"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle (optional)</Label>
                <Input
                  id="subtitle"
                  placeholder="Enter a subtitle if applicable"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Style Attributes</h2>
                <p className="text-sm text-muted-foreground">
                  Customize the look and feel of your cover. You can select from
                  presets or type custom values.
                </p>
              </div>
              {selectionAttributes.map((attribute) => (
                <AttributeContextMenu
                  key={attribute.id}
                  attribute={attribute}
                  onRename={(name) =>
                    handleRenameAttribute(attribute.id, name)
                  }
                  onUpdateDescription={(desc) =>
                    handleUpdateDescription(attribute.id, desc)
                  }
                  onRemove={
                    !attribute.builtIn
                      ? () => removeFromWizard(attribute.id)
                      : undefined
                  }
                  onUpdateValue={(valueId, updates) =>
                    handleUpdateValue(attribute.id, valueId, updates)
                  }
                  onRemoveValue={(valueId) =>
                    handleRemoveValue(attribute.id, valueId)
                  }
                >
                  <AttributeInput
                    attribute={attribute}
                    value={
                      attributes[attribute.id] ??
                      getDefaultValue(attribute.type, attribute.values[0]?.value)
                    }
                    onChange={(v) =>
                      setAttributes({ ...attributes, [attribute.id]: v })
                    }
                    onAddCustomValue={(value, label, description) =>
                      addCustomValue(attribute.id, value, label, description)
                    }
                    onRemove={
                      !attribute.builtIn
                        ? () => removeFromWizard(attribute.id)
                        : undefined
                    }
                  />
                </AttributeContextMenu>
              ))}
              <Button
                variant="outline"
                className="w-full gap-2 border-dashed"
                onClick={() => setPickerOpen(true)}
              >
                <PlusIcon className="size-4" />
                Add Attribute
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Additional Details</h2>
                <p className="text-sm text-muted-foreground">
                  Describe specific visual elements, themes, or imagery
                  you&apos;d like. The more detail, the better.
                </p>
              </div>
              {textAttributes.map((attribute) => (
                <AttributeContextMenu
                  key={attribute.id}
                  attribute={attribute}
                  onRename={(name) =>
                    handleRenameAttribute(attribute.id, name)
                  }
                  onUpdateDescription={(desc) =>
                    handleUpdateDescription(attribute.id, desc)
                  }
                  onRemove={
                    !attribute.builtIn
                      ? () => removeFromWizard(attribute.id)
                      : undefined
                  }
                  onUpdateValue={(valueId, updates) =>
                    handleUpdateValue(attribute.id, valueId, updates)
                  }
                  onRemoveValue={(valueId) =>
                    handleRemoveValue(attribute.id, valueId)
                  }
                >
                  <AttributeInput
                    attribute={attribute}
                    value={
                      attributes[attribute.id] ??
                      getDefaultValue(attribute.type)
                    }
                    onChange={(v) =>
                      setAttributes({ ...attributes, [attribute.id]: v })
                    }
                    onRemove={
                      !attribute.builtIn
                        ? () => removeFromWizard(attribute.id)
                        : undefined
                    }
                  />
                </AttributeContextMenu>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-xl font-semibold">Ready to Generate</h2>
                <p className="text-sm text-muted-foreground">
                  Review your choices and generate cover options.
                </p>
              </div>
              <div className="mx-auto max-w-sm space-y-3 rounded-lg border bg-muted/30 p-4 text-left text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">
                    Title
                  </span>
                  <span className="text-right">{title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">
                    Author
                  </span>
                  <span className="text-right">{author}</span>
                </div>
                {activeAttributes.map((attr) => {
                  const val = attributes[attr.id];
                  if (!val || (Array.isArray(val) && val.length === 0))
                    return null;
                  return (
                    <div key={attr.id}>
                      <span className="font-medium text-muted-foreground">
                        {attr.name}
                      </span>
                      {attr.type === "text" ? (
                        <p className="mt-1 text-muted-foreground">
                          {val as string}
                        </p>
                      ) : (
                        <span className="float-right text-right">
                          {formatAttrValue(val)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mx-auto max-w-sm space-y-2 text-left">
                <Label htmlFor="imageCount">
                  Number of covers to generate ({imageCount})
                </Label>
                <input
                  id="imageCount"
                  type="range"
                  min={1}
                  max={8}
                  value={imageCount}
                  onChange={(e) => setImageCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>8</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    Generate Covers
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AttributePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        availableAttributes={availableAttributes}
        onSelect={handlePickAttribute}
        onCreateNew={() => setCreateOpen(true)}
      />

      <CreateAttributeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingAttributeIds={attributeConfig.attributes.map((a) => a.id)}
        onCreateAttribute={handleCreateAttribute}
      />
    </div>
  );
}
