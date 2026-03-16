"use client";

import type React from "react";
import { useState } from "react";
import { Save, Loader2, PlusIcon } from "lucide-react";
import { toast } from "sonner";
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
import { AttributePickerDialog } from "@/components/attribute-picker-dialog";
import { CreateAttributeDialog } from "@/components/create-attribute-dialog";

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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Active = attributes present in this project's selections
  const activeAttributes = attributeConfig.attributes.filter(
    (c) => c.id in attributes,
  );

  // Available for picker = config attributes NOT in project
  const availableAttributes = attributeConfig.attributes.filter(
    (c) => !(c.id in attributes),
  );

  function updateAttribute(attributeId: string, value: string | string[]) {
    setAttributes({ ...attributes, [attributeId]: value });
    onClearActivePreset();
  }

  function addCustomValue(attributeId: string, value: string, label: string, description?: string) {
    onConfigChange(
      addValueToAttribute(attributeConfig, attributeId, value, label, description),
    );
  }

  function removeCustomValue(attributeId: string, value: string) {
    onConfigChange(
      removeValueFromAttribute(attributeConfig, attributeId, value),
    );
  }

  function removeFromProject(attributeId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [attributeId]: _, ...rest } = attributes;
    setAttributes(rest);
  }

  function handlePickAttribute(attribute: Attribute) {
    setAttributes({
      ...attributes,
      [attribute.id]: getDefaultValue(attribute.type, attribute.values[0]?.value),
    });
  }

  function handleCreateAttribute(
    attribute: Attribute,
    defaultValue: string | string[],
  ) {
    onConfigChange({
      ...attributeConfig,
      attributes: [...attributeConfig.attributes, attribute],
    });
    setAttributes({ ...attributes, [attribute.id]: defaultValue });
    toast.success(`Created "${attribute.name}"`);
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

    const activeIds = new Set(activeAttributes.map((c) => c.id));
    const newItems = [...activeAttributes];
    const [moved] = newItems.splice(draggedIndex, 1);
    newItems.splice(toIndex, 0, moved);

    const reorderedAttributes = [
      ...newItems,
      ...attributeConfig.attributes.filter((c) => !activeIds.has(c.id)),
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
          {activeAttributes.map((attribute, index) => {
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
                className={`cursor-grab active:cursor-grabbing ${
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
                  onAddCustomValue={(value, label, description) =>
                    addCustomValue(attribute.id, value, label, description)
                  }
                  onRemoveCustomValue={(value) =>
                    removeCustomValue(attribute.id, value)
                  }
                  onRemove={
                    !attribute.builtIn
                      ? () => removeFromProject(attribute.id)
                      : undefined
                  }
                />
              </div>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 border-dashed text-xs"
            onClick={() => setPickerOpen(true)}
          >
            <PlusIcon className="size-3.5" />
            Add Attribute
          </Button>
        </div>
      </div>

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
        existingAttributeIds={attributeConfig.attributes.map((c) => c.id)}
        onCreateAttribute={handleCreateAttribute}
      />
    </div>
  );
}
