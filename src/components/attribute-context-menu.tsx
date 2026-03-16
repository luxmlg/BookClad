"use client";

import { useCallback, useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { EditPopover } from "@/components/edit-attribute-popover";
import type { Attribute } from "@/lib/attributes";

type ClickTarget =
  | { type: "attribute" }
  | { type: "value"; valueId: string }
  | null;

interface AttributeContextMenuProps {
  attribute: Attribute;
  onRename: (newName: string) => void;
  onUpdateDescription: (description: string) => void;
  onRemove?: () => void;
  onUpdateValue?: (
    valueId: string,
    updates: { label?: string; description?: string },
  ) => void;
  onRemoveValue?: (valueId: string) => void;
  children: React.ReactNode;
}

export function AttributeContextMenu({
  attribute,
  onRename,
  onUpdateDescription,
  onRemove,
  onUpdateValue,
  onRemoveValue,
  children,
}: AttributeContextMenuProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [clickTarget, setClickTarget] = useState<ClickTarget>(null);

  // Detect whether user right-clicked on a label or a value badge
  const filter = useCallback((target: HTMLElement): boolean => {
    const badge = target.closest("[data-value]") as HTMLElement | null;
    if (badge?.dataset.value) {
      setEditOpen(false);
      setClickTarget({ type: "value", valueId: badge.dataset.value });
      return true;
    }
    if (target.closest("label")) {
      setEditOpen(false);
      setClickTarget({ type: "attribute" });
      return true;
    }
    return false;
  }, []);

  // Resolve the clicked value's metadata
  const clickedValue =
    clickTarget?.type === "value"
      ? attribute.values.find((v) => v.value === clickTarget.valueId)
      : null;

  // Derive popover props from what's being edited
  const editName =
    clickTarget?.type === "value"
      ? (clickedValue?.label ?? "")
      : attribute.name;
  const editDescription =
    clickTarget?.type === "value"
      ? (clickedValue?.description ?? "")
      : (attribute.description ?? "");
  const editNameDisabled =
    clickTarget?.type === "value"
      ? (clickedValue?.builtIn ?? false)
      : attribute.builtIn;

  function handleSave(name: string, description: string): void {
    if (clickTarget?.type === "value" && clickedValue) {
      const updates: { label?: string; description?: string } = {};
      if (name !== clickedValue.label) updates.label = name;
      if (description !== (clickedValue.description ?? ""))
        updates.description = description;
      if (Object.keys(updates).length > 0) {
        onUpdateValue?.(clickedValue.value, updates);
      }
    } else {
      if (name !== attribute.name) onRename(name);
      if (description !== (attribute.description ?? ""))
        onUpdateDescription(description);
    }
  }

  function handleRemove(): void {
    if (clickTarget?.type === "value" && clickedValue) {
      onRemoveValue?.(clickedValue.value);
    } else {
      onRemove?.();
    }
  }

  // Determine which menu items to show
  const isValueClick = clickTarget?.type === "value";
  const canRemove = isValueClick
    ? clickedValue && !clickedValue.builtIn && onRemoveValue
    : onRemove;

  return (
    <EditPopover
      open={editOpen}
      onOpenChange={setEditOpen}
      name={editName}
      description={editDescription}
      nameDisabled={editNameDisabled}
      onSave={handleSave}
    >
      <ContextMenu>
        <ContextMenuTrigger filter={filter}>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setEditOpen(true)}>
            <PencilIcon />
            {isValueClick ? "Edit Value..." : "Edit Attribute..."}
          </ContextMenuItem>
          {canRemove && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onClick={handleRemove}>
                <Trash2Icon />
                {isValueClick ? "Remove Value" : "Remove from Project"}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </EditPopover>
  );
}
