"use client";

import { useState, useEffect, useRef } from "react";
import {
  PlusIcon,
  Trash2Icon,
  ChevronRightIcon,
  PencilIcon,
  UploadIcon,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AttributeConfigJson,
  AttributeCategory,
  AttributeSelection,
} from "@/lib/attributes";
import { buildDefaultConfig } from "@/lib/attributes";
import { FONTS_BY_CATEGORY, loadCustomFont } from "@/lib/fonts";

interface StylePreset {
  id: string;
  name: string;
  attributes: AttributeSelection;
  promptTemplate: string | null;
}

interface UserFontSettings {
  id: string;
  family: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  url: string;
}

export function SettingsClient() {
  const [config, setConfig] = useState<AttributeConfigJson>(
    buildDefaultConfig()
  );
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [fonts, setFonts] = useState<UserFontSettings[]>([]);
  const [defaultFont, setDefaultFont] = useState("Playfair Display");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/attributes").then((r) => r.json()),
      fetch("/api/presets").then((r) => r.json()),
      fetch("/api/fonts").then((r) => r.json()),
      fetch("/api/user/preferences").then((r) => r.json()),
    ])
      .then(([configData, presetsData, fontsData, prefs]) => {
        setConfig(configData);
        setPresets(presetsData);
        setFonts(fontsData);
        if (prefs.defaultFont) setDefaultFont(prefs.defaultFont);
        // Load custom fonts for preview
        for (const f of fontsData as UserFontSettings[]) {
          loadCustomFont(f.family, f.url);
        }
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
        <TabsTrigger value="fonts">Fonts</TabsTrigger>
      </TabsList>

      <TabsContent value="categories">
        <CategoriesTab config={config} onSave={saveConfig} />
      </TabsContent>

      <TabsContent value="presets">
        <PresetsTab presets={presets} onDelete={deletePreset} />
      </TabsContent>

      <TabsContent value="fonts">
        <FontsTab
          fonts={fonts}
          setFonts={setFonts}
          defaultFont={defaultFont}
          setDefaultFont={setDefaultFont}
        />
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

// ── Fonts Tab ───────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FontsTab({
  fonts,
  setFonts,
  defaultFont,
  setDefaultFont,
}: {
  fonts: UserFontSettings[];
  setFonts: React.Dispatch<React.SetStateAction<UserFontSettings[]>>;
  defaultFont: string;
  setDefaultFont: React.Dispatch<React.SetStateAction<string>>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [renameFont, setRenameFont] = useState<UserFontSettings | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteFont, setDeleteFont] = useState<UserFontSettings | null>(null);

  async function handleDefaultFontChange(family: string) {
    setDefaultFont(family);
    try {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultFont: family }),
      });
    } catch {
      toast.error("Failed to save default font");
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/fonts/upload", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      await loadCustomFont(data.family, data.url);
      setFonts((prev) => {
        const idx = prev.findIndex((f) => f.family === data.family);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...data };
          return updated;
        }
        return [data, ...prev];
      });
      toast.success(`Font "${data.family}" uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRename() {
    if (!renameFont) return;
    const newName = renameName.trim();
    if (!newName || newName === renameFont.family) {
      setRenameFont(null);
      return;
    }
    try {
      const res = await fetch(`/api/fonts/${renameFont.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family: newName }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Rename failed");
      }
      const { projectsUpdated } = await res.json();
      await loadCustomFont(newName, renameFont.url);
      setFonts((prev) =>
        prev.map((f) => (f.id === renameFont.id ? { ...f, family: newName } : f))
      );
      if (defaultFont === renameFont.family) {
        setDefaultFont(newName);
      }
      toast.success(
        projectsUpdated > 0
          ? `Font renamed. Updated ${projectsUpdated} project${projectsUpdated === 1 ? "" : "s"}.`
          : "Font renamed."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setRenameFont(null);
    }
  }

  async function handleDelete() {
    if (!deleteFont) return;
    const isDefault = defaultFont === deleteFont.family;
    try {
      const res = await fetch(`/api/fonts/${deleteFont.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setFonts((prev) => prev.filter((f) => f.id !== deleteFont.id));
      if (isDefault) setDefaultFont("Playfair Display");
      toast.success("Font deleted");
    } catch {
      toast.error("Failed to delete font");
    } finally {
      setDeleteFont(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Default Font Picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Default Font</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Used for new text layers in the editor
              </p>
            </div>
            <div className="w-56">
              <Select
                value={defaultFont}
                onValueChange={(v) => v && handleDefaultFontChange(v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fonts.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Custom</SelectLabel>
                      {fonts.map((f) => (
                          <SelectItem key={`custom-${f.id}`} value={f.family}>
                            <span style={{ fontFamily: f.family }}>{f.family}</span>
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  )}
                  {FONTS_BY_CATEGORY.map((group) => (
                    <SelectGroup key={group.category}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.fonts.map((f) => (
                        <SelectItem key={f.family} value={f.family}>
                          <span style={{ fontFamily: f.family }}>{f.family}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Font List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Custom Fonts</h3>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon className="size-3.5" />
            {uploading ? "Uploading..." : "Upload Font"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {fonts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="font-medium">No custom fonts uploaded yet</p>
              <p className="mt-1 text-sm">
                Upload fonts here or from the editor&apos;s text toolbar.
              </p>
            </CardContent>
          </Card>
        ) : (
          fonts.map((font) => (
            <Card key={font.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{font.family}</p>
                      {defaultFont === font.family && (
                        <Badge variant="outline" className="text-[10px]">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p
                      className="mt-1.5 text-lg truncate"
                      style={{ fontFamily: font.family }}
                    >
                      The quick brown fox jumps over the lazy dog
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{font.fileName}</span>
                      <span>&middot;</span>
                      <span>{formatFileSize(font.fileSize)}</span>
                      <span>&middot;</span>
                      <span>{font.mimeType.replace("font/", "").toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setRenameFont(font);
                        setRenameName(font.family);
                      }}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteFont(font)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!renameFont} onOpenChange={(open) => !open && setRenameFont(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Font</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Font family name</Label>
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameFont(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteFont} onOpenChange={(open) => !open && setDeleteFont(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Font</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
              <p className="text-sm">
                Delete font &ldquo;{deleteFont?.family}&rdquo;? This cannot be undone.
              </p>
              <p className="text-sm text-muted-foreground">
                Any covers using this font will fall back to{" "}
                {defaultFont === deleteFont?.family
                  ? "Playfair Display (since this is your current default font, it will also be reset)."
                  : `your default font (${defaultFont}).`}
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeleteFont(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
