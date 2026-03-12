"use client";

import { useState, useEffect } from "react";
import {
  PlusIcon,
  Trash2Icon,
  ChevronRightIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  AttributeConfigJson,
  AttributeCategory,
  AttributeSelection,
} from "@/lib/attributes";
import { buildDefaultConfig } from "@/lib/attributes";

interface StylePreset {
  id: string;
  name: string;
  attributes: AttributeSelection;
  promptTemplate: string | null;
}

export function SettingsClient() {
  const [config, setConfig] = useState<AttributeConfigJson>(
    buildDefaultConfig()
  );
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/attributes").then((r) => r.json()),
      fetch("/api/presets").then((r) => r.json()),
    ])
      .then(([configData, presetsData]) => {
        setConfig(configData);
        setPresets(presetsData);
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function saveConfig(updated: AttributeConfigJson) {
    setConfig(updated);
    try {
      await fetch("/api/attributes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {
      toast.error("Failed to save");
    }
  }

  async function deletePreset(id: string) {
    try {
      await fetch(`/api/presets/${id}`, { method: "DELETE" });
      setPresets((prev) => prev.filter((p) => p.id !== id));
      toast.success("Preset deleted");
    } catch {
      toast.error("Failed to delete preset");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <Tabs defaultValue="categories">
      <TabsList className="mb-6">
        <TabsTrigger value="categories">Attribute Categories</TabsTrigger>
        <TabsTrigger value="presets">Style Presets</TabsTrigger>
      </TabsList>

      <TabsContent value="categories">
        <CategoriesTab config={config} onSave={saveConfig} />
      </TabsContent>

      <TabsContent value="presets">
        <PresetsTab presets={presets} onDelete={deletePreset} />
      </TabsContent>
    </Tabs>
  );
}

// ── Categories Tab ───────────────────────────────────────────────

function CategoriesTab({
  config,
  onSave,
}: {
  config: AttributeConfigJson;
  onSave: (config: AttributeConfigJson) => void;
}) {
  const [addingCategory, setAddingCategory] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"single" | "multi">("single");

  function toggleCategory(categoryId: string, enabled: boolean) {
    onSave({
      ...config,
      categories: config.categories.map((c) =>
        c.id === categoryId ? { ...c, enabled } : c
      ),
    });
  }

  function addValue(categoryId: string, value: string, label: string) {
    onSave({
      ...config,
      categories: config.categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              values: [...c.values, { value, label, builtIn: false }],
            }
          : c
      ),
    });
  }

  function removeValue(categoryId: string, value: string) {
    onSave({
      ...config,
      categories: config.categories.map((c) =>
        c.id === categoryId
          ? { ...c, values: c.values.filter((v) => v.value !== value) }
          : c
      ),
    });
  }

  function addCategory() {
    const name = newName.trim();
    if (!name) return;
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

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
              placeholder="Category name (e.g. Color Palette, Era)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") addCategory();
                if (e.key === "Escape") setAddingCategory(false);
              }}
            />
            <div className="flex gap-2">
              <Button
                variant={newType === "single" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewType("single")}
              >
                Single select
              </Button>
              <Button
                variant={newType === "multi" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewType("multi")}
              >
                Multi select
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addCategory}>
                Add Category
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
          Add Category
        </Button>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  onToggle,
  onAddValue,
  onRemoveValue,
  onRemoveCategory,
}: {
  category: AttributeCategory;
  onToggle: (enabled: boolean) => void;
  onAddValue: (value: string, label: string) => void;
  onRemoveValue: (value: string) => void;
  onRemoveCategory: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [addingValue, setAddingValue] = useState(false);
  const [newValue, setNewValue] = useState("");

  function handleAddValue() {
    const label = newValue.trim();
    if (!label) return;
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
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
                {category.type === "single" ? "Single" : "Multi"}
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

// ── Presets Tab ──────────────────────────────────────────────────

function PresetsTab({
  presets,
  onDelete,
}: {
  presets: StylePreset[];
  onDelete: (id: string) => void;
}) {
  if (presets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <p className="font-medium">No presets yet</p>
          <p className="mt-1 text-sm">
            Save a style preset from the editor sidebar to reuse attribute
            combinations across projects.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {presets.map((preset) => (
        <Card key={preset.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{preset.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(
                  preset.attributes as Record<string, string | string[]>
                ).map(([key, val]) => {
                  const display = Array.isArray(val)
                    ? val.join(", ")
                    : (val as string);
                  if (!display) return null;
                  return (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {key}: {display}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(preset.id)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
