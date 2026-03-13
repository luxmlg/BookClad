"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Loader2,
  ImageIcon,
  RefreshCw,
  Sparkles,
  Tablet,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GenerationPoller } from "./generation-poller";
import type { TextNodeConfig, CanvasState } from "./cover-canvas";
import { getDefaultCanvasState, migrateCanvasState } from "./cover-canvas";
import { ensureFontLoaded } from "@/lib/fonts";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";
import { GenerationHistory } from "./generation-history";
import type { AttributeConfigJson, AttributeSelection } from "@/lib/attributes";
import { buildDefaultConfig } from "@/lib/attributes";
import type Konva from "konva";
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
  canvasState: unknown;
}

interface Generation {
  id: string;
  status: string;
  createdAt: string | Date;
  imageCount?: number;
  jobType?: string;
  model?: string;
  prompt?: string;
  images: GeneratedImage[];
  parentImageId?: string | null;
  parentImage?: { id: string; storageKey: string } | null;
  attributeSnapshot?: unknown;
  textLayerSnapshot?: unknown;
}

interface Project {
  id: string;
  title: string;
  author: string;
  attributes: unknown;
  brief: string | null;
  canvasState: unknown;
  generations: Generation[];
}

export function EditorShell({ project }: { project: Project }) {
  const router = useRouter();

  const stageRef = useRef<Konva.Stage>(null);

  const initialCanvas = useMemo(() => {
    const migrated = migrateCanvasState(project.canvasState);
    if (migrated?.textNodes?.length) return migrated;
    return getDefaultCanvasState(project.title, project.author);
  }, [project.canvasState, project.title, project.author]);

  const [textNodes, setTextNodesRaw] = useState<TextNodeConfig[]>(initialCanvas.textNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<AttributeSelection>(
    (project.attributes as AttributeSelection | null) ?? {}
  );
  const [attributeConfig, setAttributeConfig] = useState<AttributeConfigJson>(
    buildDefaultConfig()
  );
  const [presets, setPresets] = useState<
    Array<{ id: string; name: string; attributes: AttributeSelection }>
  >([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
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
  const [historyOpen, setHistoryOpen] = useState(true);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [crossfadeSnapshot, setCrossfadeSnapshot] = useState<string | null>(null);
  const [kindleCrossfadeSnapshot, setKindleCrossfadeSnapshot] = useState<string | null>(null);
  const handleBgLoaded = useCallback(() => {
    setBgLoaded(true);
  }, []);
  const [kindlePreview, setKindlePreview] = useState<string | null>(null);
  const [showKindlePreview, setShowKindlePreview] = useState(true);
  const fetchedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layersCacheRef = useRef<Map<string, TextNodeConfig[]>>(new Map());

  // Prevent page-level scroll while editor is mounted
  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  // Fetch attribute config and presets
  useEffect(() => {
    fetch("/api/attributes")
      .then((r) => r.json())
      .then((config) => setAttributeConfig(config))
      .catch(() => {});
    fetch("/api/presets")
      .then((r) => r.json())
      .then((data) => setPresets(data))
      .catch(() => {});
  }, []);

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

  // Resolve layers for an image: cache → DB persisted → project template
  const getLayersForImage = useCallback((imageId: string): TextNodeConfig[] => {
    const cached = layersCacheRef.current.get(imageId);
    if (cached) return cached;

    const img = allImages.find(i => i.id === imageId);
    if (img?.canvasState) {
      const migrated = migrateCanvasState(img.canvasState);
      if (migrated?.textNodes?.length) {
        layersCacheRef.current.set(imageId, migrated.textNodes);
        return migrated.textNodes;
      }
    }

    const template = structuredClone(initialCanvas.textNodes);
    layersCacheRef.current.set(imageId, template);
    return template;
  }, [allImages, initialCanvas.textNodes]);

  // Wrap setTextNodes to also update the per-image cache
  const selectedImageIdRef = useRef(selectedImageId);
  selectedImageIdRef.current = selectedImageId;

  const setTextNodes = useCallback((updater: TextNodeConfig[] | ((prev: TextNodeConfig[]) => TextNodeConfig[])) => {
    setTextNodesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (selectedImageIdRef.current) {
        layersCacheRef.current.set(selectedImageIdRef.current, next);
      }
      return next;
    });
  }, []);

  // Initialize per-image layers cache and set initial textNodes
  useEffect(() => {
    for (const img of allImages) {
      if (img.canvasState && !layersCacheRef.current.has(img.id)) {
        const migrated = migrateCanvasState(img.canvasState);
        if (migrated?.textNodes?.length) {
          layersCacheRef.current.set(img.id, migrated.textNodes);
        }
      }
    }

    const sel = allImages.find((img) => img.selected);
    const initialId = sel?.id ?? allImages[0]?.id ?? null;
    if (initialId) {
      const layers = getLayersForImage(initialId);
      // Pre-load fonts used in initial layers for Konva canvas
      const uniqueFonts = [...new Set(layers.map((n) => n.fontFamily))];
      Promise.all(uniqueFonts.map(ensureFontLoaded));
      setSelectedImageId(initialId);
      setTextNodesRaw(layers);
    }
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


  // Auto-save canvas state (debounced 3s) — save to current image + project template
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    const imageIdToSave = selectedImageId;
    autoSaveTimerRef.current = setTimeout(() => {
      const canvasState: CanvasState = { textNodes };

      // Save to current image
      if (imageIdToSave) {
        fetch(`/api/images/${imageIdToSave}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canvasState }),
        }).catch(() => {});
      }

      // Also update project-level template (default for new images)
      fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState }),
      }).catch(() => {});
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [textNodes, selectedImageId, project.id]);

  // Capture Kindle preview from canvas (debounced 500ms, only when image is loaded)
  const kindleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (kindleTimerRef.current) clearTimeout(kindleTimerRef.current);
    if (!bgLoaded) return;
    kindleTimerRef.current = setTimeout(() => {
      if (!stageRef.current) return;
      try {
        const dataUrl = stageRef.current.toDataURL({
          pixelRatio: 0.3,
          mimeType: "image/jpeg",
          quality: 0.6,
        });
        setKindlePreview(dataUrl);
      } catch {
        // canvas not ready
      }
    }, 500);
    return () => {
      if (kindleTimerRef.current) clearTimeout(kindleTimerRef.current);
    };
  }, [textNodes, selectedImageUrl, bgLoaded]);

  const saveProject = useCallback(async () => {
    setSaving(true);
    try {
      const canvasState: CanvasState = { textNodes };
      const titleText = textNodes.find(n => n.id === "title")?.text ?? textNodes[0]?.text ?? project.title;
      const authorText = textNodes.find(n => n.id === "author")?.text ?? project.author;
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleText,
          author: authorText,
          attributes,
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
  }, [project.id, project.title, project.author, textNodes, attributes, brief]);

  async function selectImage(imageId: string) {
    if (imageId === selectedImageId) return;

    // Save current image's layers to cache and persist to server
    if (selectedImageId) {
      layersCacheRef.current.set(selectedImageId, textNodes);
      const canvasState: CanvasState = { textNodes };
      fetch(`/api/images/${selectedImageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState }),
      }).catch(() => {});
    }

    // Load layers for the new image
    const newLayers = getLayersForImage(imageId);

    // Capture current canvas as snapshot for crossfade
    if (stageRef.current) {
      try {
        const snapshot = stageRef.current.toDataURL({
          pixelRatio: 1,
          mimeType: "image/jpeg",
          quality: 0.8,
        });
        setCrossfadeSnapshot(snapshot);
      } catch {
        // canvas not ready
      }
    }
    setBgLoaded(false);
    // Capture current kindle src for crossfade before clearing
    const currentKindleSrc = kindlePreview ?? selectedImageUrl ?? null;
    if (currentKindleSrc) setKindleCrossfadeSnapshot(currentKindleSrc);
    setKindlePreview(null);

    // Ensure fonts used in the new layers are loaded for Konva
    const uniqueFonts = [...new Set(newLayers.map((n) => n.fontFamily))];
    await Promise.all(uniqueFonts.map(ensureFontLoaded));

    setTextNodesRaw(newLayers);
    setSelectedNodeId(null);
    setSelectedImageId(imageId);

    // Persist selection
    fetch(`/api/images/${imageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected: true }),
    }).catch(() => {});
  }

  async function handleRegenerate() {
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          imageCount,
          model,
          attributeSnapshot: attributes,
          textLayerSnapshot: textNodes.map((n) => ({
            name: n.name ?? n.id,
            text: n.text ?? "",
          })),
        }),
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
          attributeSnapshot: attributes,
          textLayerSnapshot: textNodes.map((n) => ({
            name: n.name ?? n.id,
            text: n.text ?? "",
          })),
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
          attributeSnapshot: attributes,
          textLayerSnapshot: textNodes.map((n) => ({
            name: n.name ?? n.id,
            text: n.text ?? "",
          })),
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
    if (!stageRef.current) {
      toast.error("No canvas to export");
      return;
    }
    try {
      // Deselect to hide transformer handles
      setSelectedNodeId(null);
      // Wait one frame for React re-render
      await new Promise((r) => setTimeout(r, 50));
      // Ensure all fonts are fully loaded before canvas export
      await document.fonts.ready;

      const dataUrl = stageRef.current.toDataURL({
        pixelRatio: 1600 / 400, // exports at full 1600x2560
        mimeType: format === "jpeg" ? "image/jpeg" : "image/png",
        quality: format === "jpeg" ? 0.95 : undefined,
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      const titleText = textNodes.find(n => n.id === "title")?.text ?? textNodes[0]?.text ?? "cover";
      a.download = `${titleText.replace(/\s+/g, "_") || "cover"}_cover.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    }
  }

  function handleConfigChange(config: AttributeConfigJson) {
    setAttributeConfig(config);
    fetch("/api/attributes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }).catch(() => {});
  }

  async function handleSavePreset(name: string) {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, attributes }),
      });
      if (res.ok) {
        const preset = await res.json();
        setPresets((prev) => [preset, ...prev]);
        setActivePresetId(preset.id);
        toast.success(`Preset "${name}" saved`);
      }
    } catch {
      toast.error("Failed to save preset");
    }
  }

  function handleApplyPreset(preset: {
    id: string;
    name: string;
    attributes: AttributeSelection;
  }) {
    setAttributes(preset.attributes as AttributeSelection);
    setActivePresetId(preset.id);
    toast.success(`Applied preset "${preset.name}"`);
  }

  function updateNode(id: string, attrs: Partial<TextNodeConfig>) {
    setTextNodes(prev => prev.map(n => n.id === id ? { ...n, ...attrs } : n));
  }

  function addTextNode() {
    const id = crypto.randomUUID();
    const newNode: TextNodeConfig = {
      id,
      name: "Text Layer",
      text: "New Text",
      x: 160,
      y: 1200,
      fontSize: 48,
      fontFamily: "Playfair Display",
      fill: "#ffffff",
      align: "center",
      fontStyle: "normal",
      width: 1280,
      visible: true,
      draggable: true,
    };
    setTextNodes(prev => [...prev, newNode]);
    setSelectedNodeId(id);
  }

  function removeTextNode(id: string) {
    setTextNodes(prev => prev.filter(n => n.id !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
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
    if (attrs.rotation !== undefined) mapped.rotation = attrs.rotation;
    updateNode(id, mapped);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left sidebar */}
      <div className="hidden lg:flex w-72 flex-col border-r bg-background">
        <LeftSidebar
          attributeConfig={attributeConfig}
          attributes={attributes}
          setAttributes={setAttributes}
          onConfigChange={handleConfigChange}
          presets={presets}
          onSavePreset={handleSavePreset}
          onApplyPreset={handleApplyPreset}
          activePresetId={activePresetId}
          onClearActivePreset={() => setActivePresetId(null)}
          brief={brief}
          setBrief={setBrief}
          imageCount={imageCount}
          setImageCount={setImageCount}
          model={model}
          setModel={setModel}
          saving={saving}
          onSave={saveProject}
          onRegenerate={handleRegenerate}
          onOpenSimilarDialog={() => setRefDialogOpen(true)}
          selectedImageId={selectedImageId}
          pendingGeneration={!!pendingGeneration}
        />
      </div>

      {/* Center: canvas + generation history */}
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
        <div className="flex flex-1 items-center justify-center gap-3 overflow-hidden p-4">
          {/* Canvas */}
          <div
            className="relative shrink-0 overflow-hidden rounded-xl border bg-background shadow-xl"
            style={{
              width: 400,
              height: 640,
            }}
          >
            {allImages.length > 0 ? (
              loadingUrls || Object.keys(imageUrls).length === 0 ? (
                <Skeleton className="h-full w-full rounded-none" />
              ) : selectedImageUrl ? (
                <>
                  {/* Crossfade overlay: shows snapshot of previous canvas, fades out when new image loads */}
                  {crossfadeSnapshot && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={crossfadeSnapshot}
                      alt=""
                      className={`absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-300 ease-in-out ${
                        bgLoaded ? "opacity-0" : "opacity-100"
                      }`}
                      onTransitionEnd={() => {
                        if (bgLoaded) setCrossfadeSnapshot(null);
                      }}
                    />
                  )}
                  <CoverCanvas
                    imageUrl={selectedImageUrl}
                    textNodes={textNodes}
                    selectedNodeId={brushMode ? null : selectedNodeId}
                    onSelectNode={brushMode ? () => {} : setSelectedNodeId}
                    onNodeDragEnd={handleNodeDragEnd}
                    onNodeTransformEnd={handleNodeTransformEnd}
                    stageRef={stageRef}
                    onImageLoad={handleBgLoaded}
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

          {/* Kindle preview — flex sibling to the right of canvas */}
          {showKindlePreview ? (
            <div className="flex w-[75px] shrink-0 flex-col items-center justify-end" style={{ height: 640 }}>
              <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Kindle ~120px
              </p>
              <button
                onClick={() => setShowKindlePreview(false)}
                className="group relative overflow-hidden rounded-lg border bg-muted/50 shadow-sm"
                style={{ width: 75, aspectRatio: "1600/2560" }}
                title="Hide preview"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={kindlePreview ?? selectedImageUrl ?? undefined}
                  alt="Kindle preview"
                  className="h-full w-full object-cover transition-[filter] group-hover:blur-sm"
                />
                {kindleCrossfadeSnapshot && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={kindleCrossfadeSnapshot}
                    alt=""
                    className={`absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-300 ease-in-out ${
                      kindlePreview || (bgLoaded && selectedImageUrl)
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                    onTransitionEnd={() => {
                      if (kindlePreview || (bgLoaded && selectedImageUrl)) {
                        setKindleCrossfadeSnapshot(null);
                      }
                    }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <EyeOff className="size-5 text-white drop-shadow-md" />
                </div>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowKindlePreview(true)}
              className="flex shrink-0 flex-col items-center justify-end gap-1 pb-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              style={{ height: 640 }}
            >
              <Tablet className="size-3.5" />
              <span>Preview</span>
            </button>
          )}
        </div>

        {/* History panel */}
        <GenerationHistory
          generations={completedGenerations}
          imageUrls={imageUrls}
          selectedImageId={selectedImageId}
          onSelect={selectImage}
          historyOpen={historyOpen}
          onHistoryOpenChange={setHistoryOpen}
        />
      </div>

      {/* Right sidebar */}
      <div className="hidden lg:flex w-72 flex-col border-l bg-background">
        <RightSidebar
          textNodes={textNodes}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          updateNode={updateNode}
          addTextNode={addTextNode}
          removeTextNode={removeTextNode}
          brushMode={brushMode}
          setBrushMode={setBrushMode}
          inpaintMask={inpaintMask}
          setInpaintMask={setInpaintMask}
          inpaintPrompt={inpaintPrompt}
          setInpaintPrompt={setInpaintPrompt}
          inpaintSubmitting={inpaintSubmitting}
          onInpaintSubmit={handleInpaintSubmit}
          selectedImageUrl={selectedImageUrl}
          onExportJpeg={() => handleExport("jpeg")}
          onExportPng={() => handleExport("png")}
        />
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

