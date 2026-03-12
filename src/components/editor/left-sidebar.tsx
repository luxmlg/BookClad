"use client";

import { useState } from "react";
import {
  Save,
  Loader2,
  RefreshCw,
  Sparkles,
  PlusIcon,
  XIcon,
  BookmarkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AI_MODELS } from "@/lib/constants";
import type {
  AttributeConfigJson,
  AttributeSelection,
  AttributeCategory,
} from "@/lib/attributes";
import { AttributeCategoryInput } from "./attribute-category-input";

interface StylePreset {
  id: string;
  name: string;
  attributes: AttributeSelection;
}

interface LeftSidebarProps {
  attributeConfig: AttributeConfigJson;
  attributes: AttributeSelection;
  setAttributes: (attrs: AttributeSelection) => void;
  onConfigChange: (config: AttributeConfigJson) => void;
  presets: StylePreset[];
  onSavePreset: (name: string) => void;
  onApplyPreset: (preset: StylePreset) => void;
  brief: string;
  setBrief: (v: string) => void;
  imageCount: number;
  setImageCount: (v: number) => void;
  model: string;
  setModel: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onRegenerate: () => void;
  onOpenSimilarDialog: () => void;
  selectedImageId: string | null;
  pendingGeneration: boolean;
}

export function LeftSidebar({
  attributeConfig,
  attributes,
  setAttributes,
  onConfigChange,
  presets,
  onSavePreset,
  onApplyPreset,
  brief,
  setBrief,
  imageCount,
  setImageCount,
  model,
  setModel,
  saving,
  onSave,
  onRegenerate,
  onOpenSimilarDialog,
  selectedImageId,
  pendingGeneration,
}: LeftSidebarProps) {
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"single" | "multi">(
    "single"
  );
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const enabledCategories = attributeConfig.categories.filter(
    (c) => c.enabled
  );

  function updateAttribute(categoryId: string, value: string | string[]) {
    setAttributes({ ...attributes, [categoryId]: value });
  }

  function addCustomValue(categoryId: string, value: string, label: string) {
    const updated = {
      ...attributeConfig,
      categories: attributeConfig.categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              values: [
                ...c.values,
                { value, label, builtIn: false },
              ],
            }
          : c
      ),
    };
    onConfigChange(updated);
  }

  function removeCustomValue(categoryId: string, value: string) {
    const updated = {
      ...attributeConfig,
      categories: attributeConfig.categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              values: c.values.filter((v) => v.value !== value || v.builtIn),
            }
          : c
      ),
    };
    onConfigChange(updated);
  }

  function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const newCat: AttributeCategory = {
      id,
      name,
      type: newCategoryType,
      builtIn: false,
      enabled: true,
      values: [],
    };

    onConfigChange({
      ...attributeConfig,
      categories: [...attributeConfig.categories, newCat],
    });
    setAttributes({
      ...attributes,
      [id]: newCategoryType === "multi" ? [] : "",
    });
    setNewCategoryName("");
    setAddingCategory(false);
  }

  function removeCategory(categoryId: string) {
    const updated = {
      ...attributeConfig,
      categories: attributeConfig.categories.filter(
        (c) => c.id !== categoryId
      ),
    };
    onConfigChange(updated);
    const { [categoryId]: _removed, ...rest } = attributes;
    setAttributes(rest);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-semibold">Book Details</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* Presets */}
          {presets.length > 0 && (
            <div className="space-y-1.5">
              <Label>Style Preset</Label>
              <Select
                onValueChange={(v) => {
                  if (!v) return;
                  const preset = presets.find((p) => p.id === v);
                  if (preset) onApplyPreset(preset);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Apply a preset..." />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dynamic attribute categories */}
          {enabledCategories.map((category) => (
            <div key={category.id} className="relative">
              <AttributeCategoryInput
                category={category}
                value={
                  attributes[category.id] ??
                  (category.type === "multi" ? [] : "")
                }
                onChange={(v) => updateAttribute(category.id, v)}
                onAddCustomValue={(value, label) =>
                  addCustomValue(category.id, value, label)
                }
                onRemoveCustomValue={(value) =>
                  removeCustomValue(category.id, value)
                }
              />
              {!category.builtIn && (
                <button
                  type="button"
                  className="absolute right-0 top-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCategory(category.id)}
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </div>
          ))}

          {/* Add category */}
          {addingCategory ? (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name..."
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCategory();
                  if (e.key === "Escape") setAddingCategory(false);
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant={
                    newCategoryType === "single" ? "default" : "outline"
                  }
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setNewCategoryType("single")}
                >
                  Single
                </Button>
                <Button
                  variant={
                    newCategoryType === "multi" ? "default" : "outline"
                  }
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setNewCategoryType("multi")}
                >
                  Multi
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-6 text-xs" onClick={addCategory}>
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setAddingCategory(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => setAddingCategory(true)}
            >
              <PlusIcon className="size-3.5" />
              Add Attribute
            </Button>
          )}

          <div className="space-y-2">
            <Label>Brief / AI Prompt</Label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Describe visual elements, themes..."
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>AI Model</Label>
            <Select value={model} onValueChange={(v) => v && setModel(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select model">
                  {AI_MODELS.find((m) => m.value === model)?.label ??
                    "Select model"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Used for generation, reference generation, and inpainting
            </p>
          </div>

          <div className="space-y-2">
            <Label>Images per generation: {imageCount}</Label>
            <Slider
              value={[imageCount]}
              onValueChange={(v) =>
                setImageCount(Array.isArray(v) ? v[0] : v)
              }
              min={1}
              max={8}
              step={1}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1</span>
              <span>8</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer — sticky bottom */}
      <div className="space-y-2 border-t p-4">
        <Button
          className="w-full gap-2"
          onClick={onRegenerate}
          disabled={pendingGeneration}
        >
          {pendingGeneration ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Generate Covers
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onOpenSimilarDialog}
          disabled={!selectedImageId}
        >
          <Sparkles className="size-4" />
          Generate Similar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => setPresetDialogOpen(true)}
        >
          <BookmarkIcon className="size-3.5" />
          Save as Preset
        </Button>
      </div>

      {/* Save Preset Dialog */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Style Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Preset Name</Label>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g., Dark Sci-Fi Noir"
              onKeyDown={(e) => {
                if (e.key === "Enter" && presetName.trim()) {
                  onSavePreset(presetName.trim());
                  setPresetName("");
                  setPresetDialogOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPresetDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!presetName.trim()}
              onClick={() => {
                onSavePreset(presetName.trim());
                setPresetName("");
                setPresetDialogOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
