"use client";

import type React from "react";
import { useState } from "react";
import { Save, Loader2, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDefaultValue,
  addValueToCategory,
  removeValueFromCategory,
  type AttributeConfigJson,
  type AttributeSelection,
  type AttributeCategory,
} from "@/lib/attributes";
import { AttributeCategoryInput } from "./attribute-category-input";
import { PresetPicker, type StylePreset } from "./preset-picker";
import { AddCategoryForm } from "./add-category-form";

interface LeftSidebarProps {
  attributeConfig: AttributeConfigJson;
  attributes: AttributeSelection;
  setAttributes: (attrs: AttributeSelection) => void;
  onConfigChange: (config: AttributeConfigJson) => void;
  presets: StylePreset[];
  onSavePreset: (name: string) => void;
  onApplyPreset: (preset: StylePreset) => void;
  activePresetId: string | null;
  onClearActivePreset: () => void;
  saving: boolean;
  onSave: () => void;
}

export function LeftSidebar({
  attributeConfig,
  attributes,
  setAttributes,
  onConfigChange,
  presets,
  onSavePreset,
  onApplyPreset,
  activePresetId,
  onClearActivePreset,
  saving,
  onSave,
}: LeftSidebarProps) {
  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const enabledCategories = attributeConfig.categories.filter(
    (c) => c.enabled,
  );

  function updateAttribute(categoryId: string, value: string | string[]) {
    setAttributes({ ...attributes, [categoryId]: value });
    onClearActivePreset();
  }

  function addCustomValue(categoryId: string, value: string, label: string) {
    onConfigChange(
      addValueToCategory(attributeConfig, categoryId, value, label),
    );
  }

  function removeCustomValue(categoryId: string, value: string) {
    onConfigChange(
      removeValueFromCategory(attributeConfig, categoryId, value),
    );
  }

  function removeCategory(categoryId: string) {
    onConfigChange({
      ...attributeConfig,
      categories: attributeConfig.categories.filter(
        (c) => c.id !== categoryId,
      ),
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [categoryId]: _, ...rest } = attributes;
    setAttributes(rest);
  }

  function handleAddCategory(
    category: AttributeCategory,
    defaultValue: string | string[],
  ) {
    onConfigChange({
      ...attributeConfig,
      categories: [...attributeConfig.categories, category],
    });
    setAttributes({ ...attributes, [category.id]: defaultValue });
  }

  // ── Drag-and-drop handlers ──────────────────────────────────────

  function handleItemDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleItemDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null) return;
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleItemDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === toIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...enabledCategories];
    const [moved] = newItems.splice(draggedIndex, 1);
    newItems.splice(toIndex, 0, moved);

    const reorderedCategories = [
      ...newItems,
      ...attributeConfig.categories.filter((c) => !c.enabled),
    ];

    onConfigChange({
      ...attributeConfig,
      categories: reorderedCategories,
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleItemDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  // ── Render ──────────────────────────────────────────────────────

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
          <PresetPicker
            presets={presets}
            activePresetId={activePresetId}
            currentAttributes={attributes}
            categories={attributeConfig.categories}
            onSavePreset={onSavePreset}
            onApplyPreset={onApplyPreset}
          />

          {/* Draggable attribute categories */}
          {enabledCategories.map((category, index) => {
            const isDragged = draggedIndex === index;
            const isDragOver =
              dragOverIndex === index && draggedIndex !== index;

            return (
              <div
                key={category.id}
                draggable
                onDragStart={(e) => handleItemDragStart(e, index)}
                onDragOver={(e) => handleItemDragOver(e, index)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleItemDrop(e, index)}
                onDragEnd={handleItemDragEnd}
                className={`relative cursor-grab active:cursor-grabbing ${
                  isDragOver ? "border-t-2 border-primary" : ""
                } ${isDragged ? "opacity-40" : ""}`}
              >
                <AttributeCategoryInput
                  category={category}
                  value={
                    attributes[category.id] ??
                    getDefaultValue(
                      category.type,
                      category.values[0]?.value,
                    )
                  }
                  onChange={(v) =>
                    updateAttribute(category.id, v)
                  }
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
            );
          })}

          <AddCategoryForm
            existingCategoryIds={attributeConfig.categories.map((c) => c.id)}
            onAddCategory={handleAddCategory}
          />
        </div>
      </div>
    </div>
  );
}
