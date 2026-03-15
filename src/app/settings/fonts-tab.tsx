"use client";

import { useRef, useState } from "react";
import {
  Trash2Icon,
  PencilIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_FONT, FONTS_BY_CATEGORY, loadCustomFont } from "@/lib/fonts";
import {
  uploadFont,
  renameFont as renameFontApi,
  deleteFont as deleteFontApi,
  type FontDetail,
} from "@/lib/api";
import { updatePreferences } from "@/lib/api";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FontsTabProps {
  fonts: FontDetail[];
  setFonts: React.Dispatch<React.SetStateAction<FontDetail[]>>;
  defaultFont: string;
  setDefaultFont: React.Dispatch<React.SetStateAction<string>>;
}

export function FontsTab({
  fonts,
  setFonts,
  defaultFont,
  setDefaultFont,
}: FontsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [renameFont, setRenameFont] = useState<FontDetail | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteFont, setDeleteFont] = useState<FontDetail | null>(null);

  async function handleDefaultFontChange(family: string) {
    setDefaultFont(family);
    try {
      await updatePreferences({ defaultFont: family });
    } catch {
      toast.error("Failed to save default font");
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const data = await uploadFont(file);
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
      const { projectsUpdated } = await renameFontApi(renameFont.id, newName);
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
      await deleteFontApi(deleteFont.id);
      setFonts((prev) => prev.filter((f) => f.id !== deleteFont.id));
      if (isDefault) setDefaultFont(DEFAULT_FONT);
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
                  ? `${DEFAULT_FONT} (since this is your current default font, it will also be reset).`
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
