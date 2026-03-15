"use client";

import { useState } from "react";
import {
  PlusIcon,
  Trash2Icon,
  ChevronRightIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  slugify,
  addValueToCategory,
  removeValueFromCategory,
  type AttributeConfigJson,
  type AttributeCategory,
} from "@/lib/attributes";

interface CategoriesTabProps {
  config: AttributeConfigJson;
  onSave: (config: AttributeConfigJson) => void;
}

export function CategoriesTab({ config, onSave }: CategoriesTabProps) {
  const [addingCategory, setAddingCategory] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AttributeCategory["type"]>("single");

  function toggleCategory(categoryId: string, enabled: boolean) {
    onSave({
      ...config,
      categories: config.categories.map((c) =>
        c.id === categoryId ? { ...c, enabled } : c
      ),
    });
  }

  function addValue(categoryId: string, value: string, label: string) {
    onSave(addValueToCategory(config, categoryId, value, label));
  }

  function removeValue(categoryId: string, value: string) {
    onSave(removeValueFromCategory(config, categoryId, value));
  }

  function addCategory() {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);

    onSave({
      ...config,
      categories: [
        ...config.categories,
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
    setAddingCategory(false);
    toast.success(`Category "${name}" added`);
  }

  function removeCategory(categoryId: string) {
    onSave({
      ...config,
      categories: config.categories.filter((c) => c.id !== categoryId),
    });
    toast.success("Category removed");
  }

  return (
    <div className="space-y-4">
      {config.categories.map((cat) => (
        <CategoryCard
          key={cat.id}
          category={cat}
          onToggle={(enabled) => toggleCategory(cat.id, enabled)}
          onAddValue={(value, label) => addValue(cat.id, value, label)}
          onRemoveValue={(value) => removeValue(cat.id, value)}
          onRemoveCategory={() => removeCategory(cat.id)}
        />
      ))}

      {addingCategory ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 p-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Attribute name (e.g. Color Palette, Era)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") addCategory();
                if (e.key === "Escape") setAddingCategory(false);
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
              <Button size="sm" onClick={addCategory}>
                Add Attribute
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddingCategory(false)}
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
          onClick={() => setAddingCategory(true)}
        >
          <PlusIcon className="size-4" />
          Add Attribute
        </Button>
      )}
    </div>
  );
}

interface CategoryCardProps {
  category: AttributeCategory;
  onToggle: (enabled: boolean) => void;
  onAddValue: (value: string, label: string) => void;
  onRemoveValue: (value: string) => void;
  onRemoveCategory: () => void;
}

function CategoryCard({
  category,
  onToggle,
  onAddValue,
  onRemoveValue,
  onRemoveCategory,
}: CategoryCardProps) {
  const [open, setOpen] = useState(false);
  const [addingValue, setAddingValue] = useState(false);
  const [newValue, setNewValue] = useState("");

  function handleAddValue() {
    const label = newValue.trim();
    if (!label) return;
    const slug = slugify(label);
    onAddValue(slug, label);
    setNewValue("");
    setAddingValue(false);
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
              <CardTitle className="text-base">{category.name}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {category.type.charAt(0).toUpperCase() + category.type.slice(1)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {category.values.length} values
              </span>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Switch
                checked={category.enabled}
                onCheckedChange={onToggle}
              />
              {!category.builtIn && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={onRemoveCategory}
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
              {category.values.map((v) => (
                <div
                  key={v.value}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{v.label}</span>
                    {v.builtIn && (
                      <Badge variant="outline" className="text-[10px]">
                        built-in
                      </Badge>
                    )}
                  </div>
                  {!v.builtIn && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveValue(v.value)}
                    >
                      <Trash2Icon className="size-3" />
                    </Button>
                  )}
                </div>
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
