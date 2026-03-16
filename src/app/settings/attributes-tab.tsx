"use client";

import { useState } from "react";
import {
  PlusIcon,
  Trash2Icon,
  ChevronRightIcon,
  RotateCcwIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  slugify,
  addValueToAttribute,
  removeValueFromAttribute,
  updateValueInAttribute,
  updateAttributeDescription,
  getDefaultAttributeDescription,
  type AttributeConfigJson,
  type Attribute,
  type AttributeValue,
} from "@/lib/attributes";
import { ValueRow } from "./value-row";

interface AttributesTabProps {
  config: AttributeConfigJson;
  onSave: (config: AttributeConfigJson) => void;
}

export function AttributesTab({ config, onSave }: AttributesTabProps) {
  const [addingAttribute, setAddingAttribute] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Attribute["type"]>("single");

  function toggleAttribute(attributeId: string, enabled: boolean) {
    onSave({
      ...config,
      attributes: config.attributes.map((c) =>
        c.id === attributeId ? { ...c, enabled } : c
      ),
    });
  }

  function addValue(attributeId: string, value: string, label: string) {
    onSave(addValueToAttribute(config, attributeId, value, label));
  }

  function removeValue(attributeId: string, value: string) {
    onSave(removeValueFromAttribute(config, attributeId, value));
  }

  function handleUpdateValue(
    attributeId: string,
    value: string,
    updates: Partial<Pick<AttributeValue, "description" | "disabled">>,
  ) {
    onSave(updateValueInAttribute(config, attributeId, value, updates));
  }

  function handleUpdateAttributeDescription(
    attributeId: string,
    description: string,
  ) {
    onSave(updateAttributeDescription(config, attributeId, description));
  }

  function addAttribute() {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);

    onSave({
      ...config,
      attributes: [
        ...config.attributes,
        {
          id,
          name,
          type: newType,
          builtIn: false,
          enabled: true,
          values: [],
        },
      ],
    });
    setNewName("");
    setAddingAttribute(false);
    toast.success(`Attribute "${name}" added`);
  }

  function removeAttribute(attributeId: string) {
    onSave({
      ...config,
      attributes: config.attributes.filter((c) => c.id !== attributeId),
    });
    toast.success("Attribute removed");
  }

  return (
    <div className="space-y-4">
      {config.attributes.map((attr) => (
        <AttributeCard
          key={attr.id}
          attribute={attr}
          onToggle={(enabled) => toggleAttribute(attr.id, enabled)}
          onAddValue={(value, label) => addValue(attr.id, value, label)}
          onRemoveValue={(value) => removeValue(attr.id, value)}
          onUpdateValue={(value, updates) =>
            handleUpdateValue(attr.id, value, updates)
          }
          onUpdateAttributeDescription={(desc) =>
            handleUpdateAttributeDescription(attr.id, desc)
          }
          onRemoveAttribute={() => removeAttribute(attr.id)}
        />
      ))}

      {addingAttribute ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 p-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Attribute name (e.g. Color Palette, Era)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") addAttribute();
                if (e.key === "Escape") setAddingAttribute(false);
              }}
            />
            <div className="flex flex-wrap gap-2">
              {(
                ["single", "multi", "text", "toggle", "scale", "color"] as const
              ).map((t) => (
                <Button
                  key={t}
                  variant={newType === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewType(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addAttribute}>
                Add Attribute
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddingAttribute(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setAddingAttribute(true)}
        >
          <PlusIcon className="size-4" />
          Add Attribute
        </Button>
      )}
    </div>
  );
}

interface AttributeCardProps {
  attribute: Attribute;
  onToggle: (enabled: boolean) => void;
  onAddValue: (value: string, label: string) => void;
  onRemoveValue: (value: string) => void;
  onUpdateValue: (
    value: string,
    updates: Partial<Pick<AttributeValue, "description" | "disabled">>,
  ) => void;
  onUpdateAttributeDescription: (description: string) => void;
  onRemoveAttribute: () => void;
}

function AttributeCard({
  attribute,
  onToggle,
  onAddValue,
  onRemoveValue,
  onUpdateValue,
  onUpdateAttributeDescription,
  onRemoveAttribute,
}: AttributeCardProps) {
  const [open, setOpen] = useState(false);
  const [addingValue, setAddingValue] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(attribute.description ?? "");

  const disabledCount = attribute.values.filter((v) => v.disabled).length;
  const defaultAttrDesc = attribute.builtIn
    ? getDefaultAttributeDescription(attribute.id)
    : undefined;
  const canRestoreAttrDesc =
    defaultAttrDesc !== undefined && attribute.description !== defaultAttrDesc;

  function handleAddValue() {
    const label = newValue.trim();
    if (!label) return;
    const slug = slugify(label);
    onAddValue(slug, label);
    setNewValue("");
    setAddingValue(false);
  }

  function handleDescBlur() {
    const trimmed = descDraft.trim();
    if (trimmed !== (attribute.description ?? "")) {
      onUpdateAttributeDescription(trimmed);
    }
    setEditingDesc(false);
  }

  function handleRestoreAttrDesc() {
    if (defaultAttrDesc !== undefined) {
      setDescDraft(defaultAttrDesc);
      onUpdateAttributeDescription(defaultAttrDesc);
    }
  }

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="p-4">
          <div className="flex items-center gap-3">
            <CollapsibleTrigger className="flex flex-1 items-center gap-2">
              <ChevronRightIcon
                className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
              />
              <CardTitle className="text-base">{attribute.name}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {attribute.type.charAt(0).toUpperCase() + attribute.type.slice(1)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {attribute.values.length} values
                {disabledCount > 0 && ` (${disabledCount} disabled)`}
              </span>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Switch
                checked={attribute.enabled}
                onCheckedChange={onToggle}
              />
              {!attribute.builtIn && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={onRemoveAttribute}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="space-y-2">
              {/* Attribute description */}
              {editingDesc ? (
                <div className="space-y-1.5">
                  <Textarea
                    rows={2}
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onBlur={handleDescBlur}
                    placeholder="Add an attribute description..."
                    className="text-xs"
                    autoFocus
                  />
                  {canRestoreAttrDesc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-xs"
                      onClick={handleRestoreAttrDesc}
                    >
                      <RotateCcwIcon className="size-3" />
                      Restore default
                    </Button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setDescDraft(attribute.description ?? "");
                    setEditingDesc(true);
                  }}
                >
                  {attribute.description || "Click to add description..."}
                </button>
              )}

              {/* Value rows */}
              {attribute.values.map((v) => (
                <ValueRow
                  key={v.value}
                  attributeId={attribute.id}
                  value={v}
                  onUpdateValue={(updates) => onUpdateValue(v.value, updates)}
                  onRemoveValue={() => onRemoveValue(v.value)}
                />
              ))}

              {addingValue ? (
                <div className="flex gap-2">
                  <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="New value..."
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddValue();
                      if (e.key === "Escape") setAddingValue(false);
                    }}
                  />
                  <Button size="sm" className="h-8" onClick={handleAddValue}>
                    Add
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setAddingValue(true)}
                >
                  <PlusIcon className="size-3" />
                  Add Value
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
