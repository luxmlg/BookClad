"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Download,
  Layers,
  Paintbrush,
  Type,
  ImageIcon,
  RefreshCw,
  Save,
  Loader2,
  Settings,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Tablet,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GenerationPoller } from "./generation-poller";
import { GENRES, MOODS, ART_STYLES, AI_MODELS } from "@/lib/constants";
import type { TextNodeConfig, CanvasState } from "./cover-canvas";
import { getDefaultCanvasState } from "./cover-canvas";
const BrushTool = dynamic(
  () => import("./brush-tool").then((m) => m.BrushTool),
  { ssr: false }
);

const CoverCanvas = dynamic(
  () => import("./cover-canvas").then((m) => m.CoverCanvas),
  { ssr: false }
);

interface GeneratedImage {
  id: string;
  storageKey: string;
  width: number;
  height: number;
  selected: boolean;
}

interface Generation {
  id: string;
  status: string;
  createdAt: string | Date;
  imageCount?: number;
  jobType?: string;
  images: GeneratedImage[];
}

interface Project {
  id: string;
  title: string;
  author: string;
  genre: string;
  mood: string[];
  style: string;
  brief: string | null;
  canvasState: unknown;
  generations: Generation[];
}

const FONT_OPTIONS = [
  "Georgia, serif",
  "Times New Roman, serif",
  "Garamond, serif",
  "Palatino, serif",
  "Helvetica, sans-serif",
  "Arial, sans-serif",
  "Futura, sans-serif",
  "Verdana, sans-serif",
  "Courier New, monospace",
  "Impact, sans-serif",
];

export function EditorShell({ project }: { project: Project }) {
  const router = useRouter();

  const initialCanvas = useMemo(() => {
    if (project.canvasState && typeof project.canvasState === "object") {
      const cs = project.canvasState as CanvasState;
      if (cs.titleNode && cs.authorNode) return cs;
    }
    return getDefaultCanvasState(project.title, project.author);
  }, [project.canvasState, project.title, project.author]);

  const [titleNode, setTitleNode] = useState<TextNodeConfig>(initialCanvas.titleNode);
  const [authorNode, setAuthorNode] = useState<TextNodeConfig>(initialCanvas.authorNode);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [genre, setGenre] = useState(project.genre);
  const [moods, setMoods] = useState<string[]>(project.mood ?? []);
  const [style, setStyle] = useState(project.style);
  const [brief, setBrief] = useState(project.brief ?? "");
  const [saving, setSaving] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [imageCount, setImageCount] = useState(4);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [refPrompt, setRefPrompt] = useState("");
  const [refSubmitting, setRefSubmitting] = useState(false);
  const [brushMode, setBrushMode] = useState(false);
  const [inpaintPrompt, setInpaintPrompt] = useState("");
  const [inpaintMask, setInpaintMask] = useState<string | null>(null);
  const [inpaintSubmitting, setInpaintSubmitting] = useState(false);
  const [model, setModel] = useState("openai");
  const fetchedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const completedGenerations = project.generations.filter(
    (g) => g.status === "COMPLETED"
  );
  const allImages = completedGenerations.flatMap((g) => g.images);
  const pendingGeneration = project.generations.find(
    (g) => g.status === "QUEUED" || g.status === "PROCESSING"
  );

  const selectedImageUrl = selectedImageId
    ? imageUrls[selectedImageId]
    : undefined;

  const activeNode = selectedNodeId === "title" ? titleNode : selectedNodeId === "author" ? authorNode : null;

  useEffect(() => {
    const sel = allImages.find((img) => img.selected);
    if (sel) setSelectedImageId(sel.id);
    else if (allImages.length > 0) setSelectedImageId(allImages[0].id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (allImages.length === 0 || fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchUrls() {
      setLoadingUrls(true);
      const urls: Record<string, string> = {};
      await Promise.all(
        allImages.map(async (img) => {
          try {
            const res = await fetch(`/api/images/${img.id}`);
            if (res.ok) {
              const data = await res.json();
              urls[img.id] = data.url;
            }
          } catch {
            // skip
          }
        })
      );
      setImageUrls(urls);
      setLoadingUrls(false);
    }
    fetchUrls();
  }, [allImages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save canvas state (debounced 3s)
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const canvasState: CanvasState = { titleNode, authorNode };
      fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState }),
      }).catch(() => {});
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [titleNode, authorNode, project.id]);

  const saveProject = useCallback(async () => {
    setSaving(true);
    try {
      const canvasState: CanvasState = { titleNode, authorNode };
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleNode.text,
          author: authorNode.text,
          genre,
          mood: moods,
          style,
          brief: brief || null,
          canvasState,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [project.id, titleNode, authorNode, genre, moods, style, brief]);

  async function selectImage(imageId: string) {
    setSelectedImageId(imageId);
    try {
      await fetch(`/api/images/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected: true }),
      });
    } catch {
      // silent
    }
  }

  async function handleRegenerate() {
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, imageCount, model }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to regenerate");
      }
      toast.success("Regeneration queued!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate");
    }
  }

  async function handleGenerateSimilar() {
    if (!selectedImageId) return;
    setRefSubmitting(true);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          imageCount,
          model,
          referenceImageId: selectedImageId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate");
      }
      toast.success("Reference generation queued!");
      setRefDialogOpen(false);
      setRefPrompt("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRefSubmitting(false);
    }
  }

  async function handleInpaintSubmit() {
    if (!selectedImageId || !inpaintMask || !inpaintPrompt.trim()) {
      toast.error("Please paint a region and enter a prompt");
      return;
    }
    setInpaintSubmitting(true);
    try {
      const res = await fetch("/api/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: selectedImageId,
          maskDataUrl: inpaintMask,
          prompt: inpaintPrompt,
          model,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Inpaint failed");
      }
      toast.success("Inpainting job queued!");
      setBrushMode(false);
      setInpaintMask(null);
      setInpaintPrompt("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inpaint failed");
    } finally {
      setInpaintSubmitting(false);
    }
  }

  async function handleExport(format: "jpeg" | "png") {
    if (!selectedImageUrl) {
      toast.error("No image selected to export");
      return;
    }
    try {
      const res = await fetch(selectedImageUrl);
      if (!res.ok) throw new Error("Failed to fetch image");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titleNode.text.replace(/\s+/g, "_")}_cover.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    }
  }

  function toggleMood(m: string) {
    setMoods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  function updateNode(id: string, attrs: Partial<TextNodeConfig>) {
    if (id === "title") setTitleNode((prev) => ({ ...prev, ...attrs }));
    if (id === "author") setAuthorNode((prev) => ({ ...prev, ...attrs }));
  }

  function handleNodeDragEnd(id: string, x: number, y: number) {
    const SCALE = 400 / 1600;
    updateNode(id, { x: x / SCALE, y: y / SCALE });
  }

  function handleNodeTransformEnd(id: string, attrs: Partial<TextNodeConfig>) {
    const SCALE = 400 / 1600;
    const mapped: Partial<TextNodeConfig> = {};
    if (attrs.x !== undefined) mapped.x = attrs.x / SCALE;
    if (attrs.y !== undefined) mapped.y = attrs.y / SCALE;
    if (attrs.width !== undefined) mapped.width = attrs.width / SCALE;
    if (attrs.fontSize !== undefined) mapped.fontSize = attrs.fontSize / SCALE;
    updateNode(id, mapped);
  }

  function moveLayer(fromIdx: number, toIdx: number) {
    // Layers order doesn't affect Konva rendering in this simple setup,
    // but visually reorders the list
    // (full z-index support requires a Konva layer reorder which is Phase C advanced)
  }

  const layerItems = [
    { id: "bg", name: "Background Image", type: "image" as const, visible: true, locked: true },
    { id: "title", name: "Title Text", type: "text" as const, visible: titleNode.visible, locked: !titleNode.draggable },
    { id: "author", name: "Author Text", type: "text" as const, visible: authorNode.visible, locked: !authorNode.draggable },
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Canvas area */}
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/20 p-4 lg:p-8">
        <div
          className="relative overflow-hidden rounded-xl border bg-background shadow-xl"
          style={{
            width: 400,
            height: 640,
          }}
        >
          {allImages.length > 0 ? (
            loadingUrls ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : selectedImageUrl ? (
              <>
                <CoverCanvas
                  imageUrl={selectedImageUrl}
                  titleNode={titleNode}
                  authorNode={authorNode}
                  selectedNodeId={brushMode ? null : selectedNodeId}
                  onSelectNode={brushMode ? () => {} : setSelectedNodeId}
                  onNodeDragEnd={handleNodeDragEnd}
                  onNodeTransformEnd={handleNodeTransformEnd}
                />
                {brushMode && !inpaintMask && (
                  <div className="absolute inset-0">
                    <BrushTool
                      onExportMask={(dataUrl) => setInpaintMask(dataUrl)}
                      onCancel={() => setBrushMode(false)}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                <div>
                  <ImageIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p>Select an image below</p>
                </div>
              </div>
            )
          ) : pendingGeneration ? (
            <GenerationPoller
              generationId={pendingGeneration.id}
              status={pendingGeneration.status}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <ImageIcon className="size-12 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">
                No generated images yet
              </p>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <RefreshCw className="mr-2 size-3.5" />
                Generate Now
              </Button>
            </div>
          )}
        </div>

        {/* Generation history */}
        <div className="mt-4 w-full max-w-xl">
          <ScrollArea className="max-h-40">
            <div className="space-y-2">
              {completedGenerations.map((gen, idx) => (
                <GenerationGroup
                  key={gen.id}
                  generation={gen}
                  index={completedGenerations.length - idx}
                  imageUrls={imageUrls}
                  selectedImageId={selectedImageId}
                  onSelect={selectImage}
                  defaultOpen={idx === 0}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Properties panel */}
      <div className="flex w-80 flex-col border-l bg-background">
        {/* Kindle preview at top of panel */}
        <div className="flex items-center gap-3 border-b p-3">
          <div
            className="shrink-0 overflow-hidden rounded border bg-muted/50 shadow-sm"
            style={{ width: 40, aspectRatio: "1600/2560" }}
          >
            {selectedImageUrl ? (
              <Image
                src={selectedImageUrl}
                alt="Kindle preview"
                width={40}
                height={64}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Tablet className="size-3 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Kindle Preview (~120px)
            </p>
            <p className="truncate text-xs font-medium">{titleNode.text || "Untitled"}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={saveProject}
            disabled={saving}
            className="shrink-0 gap-1.5"
          >
            <Save className="size-3.5" />
            {saving ? "..." : "Save"}
          </Button>
        </div>

        <Tabs defaultValue="text" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-2 shrink-0">
            <TabsTrigger value="text" className="gap-1 text-xs">
              <Type className="size-3" />
              Text
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-xs">
              <Settings className="size-3" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="layers" className="gap-1 text-xs">
              <Layers className="size-3" />
              Layers
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-1 text-xs">
              <Paintbrush className="size-3" />
              Edit
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="text" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="space-y-4 p-4">
                  {/* Title controls */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Title
                    </Label>
                    <Input
                      value={titleNode.text}
                      onChange={(e) =>
                        updateNode("title", { text: e.target.value })
                      }
                      placeholder="Book title"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Font</Label>
                        <Select
                          value={titleNode.fontFamily}
                          onValueChange={(v) =>
                            v && updateNode("title", { fontFamily: v })
                          }
                        >
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_OPTIONS.map((f) => (
                              <SelectItem key={f} value={f}>
                                <span style={{ fontFamily: f }}>
                                  {f.split(",")[0]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Size</Label>
                        <Input
                          type="number"
                          value={Math.round(titleNode.fontSize)}
                          onChange={(e) =>
                            updateNode("title", {
                              fontSize: Number(e.target.value) || 48,
                            })
                          }
                          min={12}
                          max={300}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Color</Label>
                        <Input
                          type="color"
                          value={titleNode.fill.startsWith("rgba") ? "#ffffff" : titleNode.fill}
                          onChange={(e) =>
                            updateNode("title", { fill: e.target.value })
                          }
                          className="h-8 w-12 p-0.5"
                        />
                      </div>
                      <div className="flex gap-1 pt-4">
                        <Button
                          variant={
                            titleNode.fontStyle.includes("bold")
                              ? "default"
                              : "outline"
                          }
                          size="icon-sm"
                          onClick={() =>
                            updateNode("title", {
                              fontStyle: titleNode.fontStyle.includes("bold")
                                ? titleNode.fontStyle.replace("bold", "").trim() || "normal"
                                : (titleNode.fontStyle + " bold").trim(),
                            })
                          }
                        >
                          <Bold className="size-3" />
                        </Button>
                        <Button
                          variant={
                            titleNode.fontStyle.includes("italic")
                              ? "default"
                              : "outline"
                          }
                          size="icon-sm"
                          onClick={() =>
                            updateNode("title", {
                              fontStyle: titleNode.fontStyle.includes("italic")
                                ? titleNode.fontStyle.replace("italic", "").trim() || "normal"
                                : (titleNode.fontStyle + " italic").trim(),
                            })
                          }
                        >
                          <Italic className="size-3" />
                        </Button>
                        <Button
                          variant={titleNode.align === "left" ? "default" : "outline"}
                          size="icon-sm"
                          onClick={() =>
                            updateNode("title", { align: "left" })
                          }
                        >
                          <AlignLeft className="size-3" />
                        </Button>
                        <Button
                          variant={titleNode.align === "center" ? "default" : "outline"}
                          size="icon-sm"
                          onClick={() =>
                            updateNode("title", { align: "center" })
                          }
                        >
                          <AlignCenter className="size-3" />
                        </Button>
                        <Button
                          variant={titleNode.align === "right" ? "default" : "outline"}
                          size="icon-sm"
                          onClick={() =>
                            updateNode("title", { align: "right" })
                          }
                        >
                          <AlignRight className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Author controls */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Author
                    </Label>
                    <Input
                      value={authorNode.text}
                      onChange={(e) =>
                        updateNode("author", { text: e.target.value })
                      }
                      placeholder="Author name"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Font</Label>
                        <Select
                          value={authorNode.fontFamily}
                          onValueChange={(v) =>
                            v && updateNode("author", { fontFamily: v })
                          }
                        >
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_OPTIONS.map((f) => (
                              <SelectItem key={f} value={f}>
                                <span style={{ fontFamily: f }}>
                                  {f.split(",")[0]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Size</Label>
                        <Input
                          type="number"
                          value={Math.round(authorNode.fontSize)}
                          onChange={(e) =>
                            updateNode("author", {
                              fontSize: Number(e.target.value) || 32,
                            })
                          }
                          min={12}
                          max={200}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Color</Label>
                        <Input
                          type="color"
                          value={authorNode.fill.startsWith("rgba") ? "#ffffff" : authorNode.fill}
                          onChange={(e) =>
                            updateNode("author", { fill: e.target.value })
                          }
                          className="h-8 w-12 p-0.5"
                        />
                      </div>
                      <div className="flex gap-1 pt-4">
                        <Button
                          variant={
                            authorNode.fontStyle.includes("bold")
                              ? "default"
                              : "outline"
                          }
                          size="icon-sm"
                          onClick={() =>
                            updateNode("author", {
                              fontStyle: authorNode.fontStyle.includes("bold")
                                ? authorNode.fontStyle.replace("bold", "").trim() || "normal"
                                : (authorNode.fontStyle + " bold").trim(),
                            })
                          }
                        >
                          <Bold className="size-3" />
                        </Button>
                        <Button
                          variant={
                            authorNode.fontStyle.includes("italic")
                              ? "default"
                              : "outline"
                          }
                          size="icon-sm"
                          onClick={() =>
                            updateNode("author", {
                              fontStyle: authorNode.fontStyle.includes("italic")
                                ? authorNode.fontStyle.replace("italic", "").trim() || "normal"
                                : (authorNode.fontStyle + " italic").trim(),
                            })
                          }
                        >
                          <Italic className="size-3" />
                        </Button>
                        <Button
                          variant={authorNode.align === "left" ? "default" : "outline"}
                          size="icon-sm"
                          onClick={() =>
                            updateNode("author", { align: "left" })
                          }
                        >
                          <AlignLeft className="size-3" />
                        </Button>
                        <Button
                          variant={authorNode.align === "center" ? "default" : "outline"}
                          size="icon-sm"
                          onClick={() =>
                            updateNode("author", { align: "center" })
                          }
                        >
                          <AlignCenter className="size-3" />
                        </Button>
                        <Button
                          variant={authorNode.align === "right" ? "default" : "outline"}
                          size="icon-sm"
                          onClick={() =>
                            updateNode("author", { align: "right" })
                          }
                        >
                          <AlignRight className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="settings" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <Label>Genre</Label>
                    <Select value={genre} onValueChange={(v) => v && setGenre(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRES.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Mood</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {MOODS.map((m) => (
                        <Badge
                          key={m}
                          variant={moods.includes(m) ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleMood(m)}
                        >
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Art Style</Label>
                    <Select value={style} onValueChange={(v) => v && setStyle(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        {ART_STYLES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Brief / Description</Label>
                    <Textarea
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      rows={4}
                      placeholder="Describe visual elements, themes..."
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Images per generation: {imageCount}</Label>
                    <Slider
                      value={[imageCount]}
                      onValueChange={(v) =>
                        setImageCount(Array.isArray(v) ? v[0] : v)
                      }
                      min={1}
                      max={8}
                      step={1}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1</span>
                      <span>8</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>AI Model</Label>
                    <Select value={model} onValueChange={(v) => v && setModel(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Used for generation, reference generation, and inpainting
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="layers" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="space-y-1 p-4">
                  {layerItems.map((layer) => (
                    <Card
                      key={layer.id}
                      className={`flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-colors ${
                        selectedNodeId === layer.id
                          ? "ring-1 ring-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        if (layer.type === "text") setSelectedNodeId(layer.id);
                      }}
                    >
                      <GripVertical className="size-3.5 text-muted-foreground/50 cursor-grab" />
                      <div className="flex h-7 w-5 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                        {layer.type === "image" ? "img" : "T"}
                      </div>
                      <span className="flex-1 text-sm truncate">{layer.name}</span>
                      {layer.type === "text" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNode(layer.id, {
                                visible: !layer.visible,
                              });
                            }}
                            className="p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            {layer.visible ? (
                              <Eye className="size-3.5" />
                            ) : (
                              <EyeOff className="size-3.5" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNode(layer.id, {
                                draggable: layer.locked,
                              });
                            }}
                            className="p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            {layer.locked ? (
                              <Lock className="size-3.5" />
                            ) : (
                              <Unlock className="size-3.5" />
                            )}
                          </button>
                        </>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="edit" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="space-y-3 p-4">
                  {!brushMode ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Paint over an area of the selected image you want to change,
                        then describe the replacement. Uses Ideogram V3 (if configured)
                        or OpenAI for inpainting.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => setBrushMode(true)}
                        disabled={!selectedImageUrl}
                      >
                        <Paintbrush className="size-4" />
                        Edit Region
                      </Button>
                    </>
                  ) : (
                    <>
                      {inpaintMask ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 overflow-hidden rounded border" style={{ width: 48, aspectRatio: "1600/2560" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={inpaintMask}
                                alt="Mask preview"
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Mask captured</p>
                              <p className="text-xs text-muted-foreground">
                                White regions will be edited.
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Describe what should replace the painted region.
                          </p>
                          <Textarea
                            value={inpaintPrompt}
                            onChange={(e) => setInpaintPrompt(e.target.value)}
                            placeholder="e.g. Replace with a sunset sky, add a castle in the background..."
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setInpaintMask(null);
                              }}
                            >
                              Re-paint
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={handleInpaintSubmit}
                              disabled={
                                inpaintSubmitting || !inpaintPrompt.trim()
                              }
                            >
                              {inpaintSubmitting ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="size-3.5" />
                              )}
                              Apply Edit
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setBrushMode(false);
                              setInpaintMask(null);
                              setInpaintPrompt("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Paint over the area you want to change, then click
                            &quot;Done&quot; on the canvas toolbar.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <Separator />
        <div className="space-y-2 p-3 shrink-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              className="flex-1 gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Regenerate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefDialogOpen(true)}
              disabled={!selectedImageId}
              className="flex-1 gap-1.5"
            >
              <Sparkles className="size-3.5" />
              Similar
            </Button>
          </div>
          <Button
            className="w-full gap-2"
            size="sm"
            onClick={() => handleExport("jpeg")}
            disabled={!selectedImageUrl}
          >
            <Download className="size-4" />
            Export JPEG (KDP-Ready)
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            size="sm"
            onClick={() => handleExport("png")}
            disabled={!selectedImageUrl}
          >
            <Download className="size-4" />
            Export PNG
          </Button>
        </div>
      </div>

      {/* Generate Similar Dialog */}
      <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Similar Covers</DialogTitle>
            <DialogDescription>
              Create new covers inspired by the selected image. Optionally add a
              prompt to guide the variation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedImageUrl && (
              <div className="flex justify-center">
                <div
                  className="overflow-hidden rounded-lg border"
                  style={{ width: 120, aspectRatio: "1600/2560" }}
                >
                  <Image
                    src={selectedImageUrl}
                    alt="Reference"
                    width={120}
                    height={192}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Additional instructions (optional)</Label>
              <Textarea
                value={refPrompt}
                onChange={(e) => setRefPrompt(e.target.value)}
                placeholder="e.g. Make it more dramatic, change the color palette to warm tones..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Number of variations: {imageCount}</Label>
              <Slider
                value={[imageCount]}
                onValueChange={(v) =>
                  setImageCount(Array.isArray(v) ? v[0] : v)
                }
                min={1}
                max={8}
                step={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateSimilar}
              disabled={refSubmitting}
              className="gap-2"
            >
              {refSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GenerationGroup({
  generation,
  index,
  imageUrls,
  selectedImageId,
  onSelect,
  defaultOpen,
}: {
  generation: Generation;
  index: number;
  imageUrls: Record<string, string>;
  selectedImageId: string | null;
  onSelect: (id: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const date =
    typeof generation.createdAt === "string"
      ? new Date(generation.createdAt)
      : generation.createdAt;
  const label = `Generation #${index}`;
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors">
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {generation.images.length} images
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{timeStr}</span>
        {generation.jobType && generation.jobType !== "generate" && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {generation.jobType === "generate-from-reference"
              ? "ref"
              : generation.jobType}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex gap-2 px-2 py-1.5">
          {generation.images.map((img) => (
            <button
              key={img.id}
              onClick={() => onSelect(img.id)}
              className={`overflow-hidden rounded-lg border-2 transition-all ${
                selectedImageId === img.id
                  ? "border-primary shadow-md"
                  : "border-transparent hover:border-muted-foreground/30"
              }`}
              style={{ width: 44, aspectRatio: "1600/2560" }}
            >
              {imageUrls[img.id] ? (
                <Image
                  src={imageUrls[img.id]}
                  alt={`Option ${img.id.slice(0, 4)}`}
                  width={44}
                  height={70}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-muted/50 text-[7px] text-muted-foreground">
                  {img.id.slice(0, 4)}
                </div>
              )}
            </button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
