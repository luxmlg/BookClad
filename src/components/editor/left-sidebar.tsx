"use client";

import type React from "react";
import { useState, useRef } from "react";
import { Save, Loader2, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getDefaultValue,
  addValueToAttribute,
  removeValueFromAttribute,
  updateValueInAttribute,
  renameAttribute,
  updateAttributeDescription,
  slugify,
  type AttributeConfigJson,
  type AttributeSelection,
  type Attribute,
} from "@/lib/attributes";
import { AttributeInput } from "./attribute-input";
import { PresetPicker, type StylePreset } from "./preset-picker";
import { AttributePickerDialog } from "@/components/attribute-picker-dialog";
import { CreateAttributeDialog } from "@/components/create-attribute-dialog";
import { AttributeContextMenu } from "@/components/attribute-context-menu";
import { AiFillPopover } from "./ai-fill-popover";
import { AiFillReviewDialog } from "./ai-fill-review-dialog";
import type { AiFillSuggestion } from "@/lib/ai-fill";
import { useCreditStore } from "@/lib/stores/credit-store";

interface LeftSidebarProps {
  projectId: string;
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
  draftKeys: Set<string>;
  onDiscardAttributeDraft: (key: string) => void;
}

export function LeftSidebar({
  projectId,
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
  draftKeys,
  onDiscardAttributeDraft,
}: LeftSidebarProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragHandleActiveRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiFillPrompt, setAiFillPrompt] = useState("");
  const [aiFillSuggestions, setAiFillSuggestions] = useState<AiFillSuggestion[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [aiFillLoading, setAiFillLoading] = useState(false);

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

  function addCustomValue(attributeId: string, value: string, label: string, description?: string, colors?: string[]) {
    onConfigChange(
      addValueToAttribute(attributeConfig, attributeId, value, label, description, colors),
    );
  }

  function removeCustomValue(attributeId: string, value: string) {
    onConfigChange(
      removeValueFromAttribute(attributeConfig, attributeId, value),
    );
  }

  function handleRenameAttribute(attributeId: string, newName: string) {
    onConfigChange(renameAttribute(attributeConfig, attributeId, newName));
  }

  function handleUpdateDescription(attributeId: string, description: string) {
    onConfigChange(
      updateAttributeDescription(attributeConfig, attributeId, description),
    );
  }

  function handleUpdateValue(
    attributeId: string,
    valueId: string,
    updates: { label?: string; description?: string },
  ) {
    onConfigChange(
      updateValueInAttribute(attributeConfig, attributeId, valueId, updates),
    );
  }

  function handleRemoveValue(attributeId: string, valueId: string) {
    onConfigChange(
      removeValueFromAttribute(attributeConfig, attributeId, valueId),
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

  // ── AI Fill handlers ────────────────────────────────────────────

  function handleAiFillSuggestions(suggestions: AiFillSuggestion[]) {
    setAiFillSuggestions(suggestions);
    setReviewOpen(true);
  }

  function handleApplyAiFill(selected: AiFillSuggestion[]) {
    let updatedConfig = attributeConfig;
    const updatedAttrs = { ...attributes };

    for (const suggestion of selected) {
      // Resolve the attribute ID — for "new" suggestions, check if one already exists
      const resolvedId = suggestion.isNew && suggestion.newAttribute
        ? slugify(suggestion.newAttribute.name)
        : suggestion.attributeId;

      if (!resolvedId) continue;

      const existingAttr = updatedConfig.attributes.find((a) => a.id === resolvedId);

      if (!existingAttr && suggestion.newAttribute) {
        // Truly new attribute — add to config
        const newAttr = {
          id: resolvedId,
          name: suggestion.newAttribute.name,
          type: suggestion.newAttribute.type,
          builtIn: false,
          enabled: true,
          description: suggestion.newAttribute.description,
          values: (suggestion.newAttribute.values ?? []).map((v) => ({ ...v, builtIn: false })),
          scaleLabels: suggestion.newAttribute.scaleLabels,
        };
        updatedConfig = {
          attributes: [...updatedConfig.attributes, newAttr],
        };
      } else if (suggestion.newValues) {
        // Add new values to existing attribute
        for (const nv of suggestion.newValues) {
          updatedConfig = addValueToAttribute(
            updatedConfig,
            resolvedId,
            nv.value,
            nv.label,
            nv.description,
            nv.colors
          );
        }
      }

      updatedAttrs[resolvedId] = suggestion.value;
    }

    onConfigChange(updatedConfig);
    setAttributes(updatedAttrs);
    onClearActivePreset();
    useCreditStore.getState().refreshCredits();
  }

  function handleAiFillRegenerate() {
    setPopoverOpen(true);
  }

  // ── Drag-and-drop handlers ──────────────────────────────────────

  function handleItemDragStart(e: React.DragEvent, index: number) {
    if (!dragHandleActiveRef.current) {
      e.preventDefault();
      return;
    }
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
    dragHandleActiveRef.current = false;
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
                onMouseDown={(e) => {
                  const target = e.target as HTMLElement;
                  dragHandleActiveRef.current = !!target.closest("[data-drag-handle]");
                }}
                onDragStart={(e) => handleItemDragStart(e, index)}
                onDragOver={(e) => handleItemDragOver(e, index)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleItemDrop(e, index)}
                onDragEnd={handleItemDragEnd}
                className={`${
                  isDragOver ? "border-t-2 border-primary" : ""
                } ${isDragged ? "opacity-40" : ""}`}
              >
                <AttributeContextMenu
                  attribute={attribute}
                  onRename={(name) =>
                    handleRenameAttribute(attribute.id, name)
                  }
                  onUpdateDescription={(desc) =>
                    handleUpdateDescription(attribute.id, desc)
                  }
                  onRemove={() => removeFromProject(attribute.id)}
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
                      getDefaultValue(
                        attribute.type,
                        attribute.values[0]?.value,
                      )
                    }
                    onChange={(v) =>
                      updateAttribute(attribute.id, v)
                    }
                    onAddCustomValue={(value, label, description, colors) =>
                      addCustomValue(attribute.id, value, label, description, colors)
                    }
                    onRemoveCustomValue={(value) =>
                      removeCustomValue(attribute.id, value)
                    }
                    onRemove={
                      !attribute.builtIn
                        ? () => removeFromProject(attribute.id)
                        : undefined
                    }
                    isDraft={draftKeys.has(attribute.id)}
                    onDiscardDraft={
                      draftKeys.has(attribute.id)
                        ? () => onDiscardAttributeDraft(attribute.id)
                        : undefined
                    }
                  />
                </AttributeContextMenu>
              </div>
            );
          })}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 border-dashed text-xs"
              onClick={() => setPickerOpen(true)}
            >
              <PlusIcon className="size-3.5" />
              Add Attribute
            </Button>
            <div className="flex-1">
              <AiFillPopover
                projectId={projectId}
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
                prompt={aiFillPrompt}
                onPromptChange={setAiFillPrompt}
                loading={aiFillLoading}
                onLoadingChange={setAiFillLoading}
                onSuggestions={handleAiFillSuggestions}
              />
            </div>
          </div>
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

      <AiFillReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        suggestions={aiFillSuggestions}
        onApply={handleApplyAiFill}
        onRegenerate={handleAiFillRegenerate}
      />
    </div>
  );
}
