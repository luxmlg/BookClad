"use client";

import type React from "react";
import { useState } from "react";
import { Save, Loader2, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  brief: string;
  setBrief: (v: string) => void;
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
  brief,
  setBrief,
  saving,
  onSave,
}: LeftSidebarProps) {
  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Build flat ordered list: enabled categories + brief
  type SidebarItem =
    | { kind: "category"; category: AttributeCategory }
    | { kind: "brief" };

  const enabledCategories = attributeConfig.categories.filter(
    (c) => c.enabled,
  );
  const briefPos = Math.min(
    attributeConfig.briefPosition ??
      enabledCategories.filter((c) => c.builtIn).length,
    enabledCategories.length,
  );
  const sidebarItems: SidebarItem[] = [
    ...enabledCategories
      .slice(0, briefPos)
      .map((c) => ({ kind: "category" as const, category: c })),
    { kind: "brief" as const },
    ...enabledCategories
      .slice(briefPos)
      .map((c) => ({ kind: "category" as const, category: c })),
  ];

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
    const { [categoryId]: _removed, ...rest } = attributes;
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

    const newItems = [...sidebarItems];
    const [moved] = newItems.splice(draggedIndex, 1);
    newItems.splice(toIndex, 0, moved);

    const orderedCatIds: string[] = [];
    let newBriefPos = 0;
    for (const item of newItems) {
      if (item.kind === "brief") {
        newBriefPos = orderedCatIds.length;
      } else {
        orderedCatIds.push(item.category.id);
      }
    }

    const reorderedCategories = [
      ...orderedCatIds.map(
        (id) => attributeConfig.categories.find((c) => c.id === id)!,
      ),
      ...attributeConfig.categories.filter((c) => !c.enabled),
    ];

    onConfigChange({
      ...attributeConfig,
      categories: reorderedCategories,
      briefPosition: newBriefPos,
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

          {/* Draggable items: categories + brief */}
          {sidebarItems.map((item, index) => {
            const key =
              item.kind === "brief" ? "__brief__" : item.category.id;
            const isDragged = draggedIndex === index;
            const isDragOver =
              dragOverIndex === index && draggedIndex !== index;

            return (
              <div
                key={key}
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
                {item.kind === "brief" ? (
                  <div className="space-y-2">
                    <Label>Brief / AI Prompt</Label>
                    <Textarea
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      rows={4}
                      placeholder="Describe visual elements, themes..."
                    />
                  </div>
                ) : (
                  <>
                    <AttributeCategoryInput
                      category={item.category}
                      value={
                        attributes[item.category.id] ??
                        getDefaultValue(
                          item.category.type,
                          item.category.values[0]?.value,
                        )
                      }
                      onChange={(v) =>
                        updateAttribute(item.category.id, v)
                      }
                      onAddCustomValue={(value, label) =>
                        addCustomValue(item.category.id, value, label)
                      }
                      onRemoveCustomValue={(value) =>
                        removeCustomValue(item.category.id, value)
                      }
                    />
                    {!item.category.builtIn && (
                      <button
                        type="button"
                        className="absolute right-0 top-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCategory(item.category.id)}
                      >
                        <XIcon className="size-3" />
                      </button>
                    )}
                  </>
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
