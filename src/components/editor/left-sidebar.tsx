"use client";

import type React from "react";
import { useState } from "react";
import { Save, Loader2, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDefaultValue,
  addValueToAttribute,
  removeValueFromAttribute,
  type AttributeConfigJson,
  type AttributeSelection,
  type Attribute,
} from "@/lib/attributes";
import { AttributeInput } from "./attribute-input";
import { PresetPicker, type StylePreset } from "./preset-picker";
import { AddAttributeForm } from "./add-attribute-form";

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

  const enabledAttributes = attributeConfig.attributes.filter(
    (c) => c.enabled,
  );

  function updateAttribute(attributeId: string, value: string | string[]) {
    setAttributes({ ...attributes, [attributeId]: value });
    onClearActivePreset();
  }

  function addCustomValue(attributeId: string, value: string, label: string) {
    onConfigChange(
      addValueToAttribute(attributeConfig, attributeId, value, label),
    );
  }

  function removeCustomValue(attributeId: string, value: string) {
    onConfigChange(
      removeValueFromAttribute(attributeConfig, attributeId, value),
    );
  }

  function removeAttribute(attributeId: string) {
    onConfigChange({
      ...attributeConfig,
      attributes: attributeConfig.attributes.filter(
        (c) => c.id !== attributeId,
      ),
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [attributeId]: _, ...rest } = attributes;
    setAttributes(rest);
  }

  function handleAddAttribute(
    attribute: Attribute,
    defaultValue: string | string[],
  ) {
    onConfigChange({
      ...attributeConfig,
      attributes: [...attributeConfig.attributes, attribute],
    });
    setAttributes({ ...attributes, [attribute.id]: defaultValue });
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

    const newItems = [...enabledAttributes];
    const [moved] = newItems.splice(draggedIndex, 1);
    newItems.splice(toIndex, 0, moved);

    const reorderedAttributes = [
      ...newItems,
      ...attributeConfig.attributes.filter((c) => !c.enabled),
    ];

    onConfigChange({
      ...attributeConfig,
      attributes: reorderedAttributes,
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
            attributes={attributeConfig.attributes}
            onSavePreset={onSavePreset}
            onApplyPreset={onApplyPreset}
          />

          {/* Draggable attributes */}
          {enabledAttributes.map((attribute, index) => {
            const isDragged = draggedIndex === index;
            const isDragOver =
              dragOverIndex === index && draggedIndex !== index;

            return (
              <div
                key={attribute.id}
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
                <AttributeInput
                  attribute={attribute}
                  value={
                    attributes[attribute.id] ??
                    getDefaultValue(
                      attribute.type,
                      attribute.values[0]?.value,
                    )
                  }
                  onChange={(v) =>
                    updateAttribute(attribute.id, v)
                  }
                  onAddCustomValue={(value, label) =>
                    addCustomValue(attribute.id, value, label)
                  }
                  onRemoveCustomValue={(value) =>
                    removeCustomValue(attribute.id, value)
                  }
                />
                {!attribute.builtIn && (
                  <button
                    type="button"
                    className="absolute right-0 top-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAttribute(attribute.id)}
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </div>
            );
          })}

          <AddAttributeForm
            existingAttributeIds={attributeConfig.attributes.map((c) => c.id)}
            onAddAttribute={handleAddAttribute}
          />
        </div>
      </div>
    </div>
  );
}
