"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Loader2,
  ImageIcon,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TextNodeConfig, ImageNodeConfig, CanvasNode, CanvasState } from "./cover-canvas";
import { getDefaultCanvasState, parseCanvasState, CANVAS_WIDTH, CANVAS_HEIGHT, SCALE, NODE_TYPE } from "./cover-canvas";
import { KDP, GENERATION_STATUS, IMAGE_COUNT_KEY_PREFIX } from "@/lib/constants";
import { DEFAULT_FONT, ensureFontLoaded, loadCustomFont } from "@/lib/fonts";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";
import { TextFloatingToolbar } from "./text-floating-toolbar";
import { InpaintToolbar } from "./inpaint-toolbar";
import { GenerationHistory } from "./generation-history";
import { GenerationQueue } from "./generation-queue";
import { GenerateSimilarDialog } from "./generate-similar-dialog";
import { InpaintDialog } from "./inpaint-dialog";
import { KindlePreview } from "./kindle-preview";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { AttributeConfigJson, AttributeSelection } from "@/lib/attributes";
import { buildDefaultConfig } from "@/lib/attributes";
import {
  getAttributeConfig,
  saveAttributeConfig,
  getPresets,
  getProjectAssets,
  listFonts,
  getPreferences,
  getImageUrl,
  updateImage,
  updateProject,
  uploadAsset,
  uploadFont,
  createGeneration,
  createInpaint,
  createPreset,
  fireAndForget,
} from "@/lib/api";
import type Konva from "konva";
const BrushTool = dynamic(
  () => import("./brush-tool").then((m) => m.BrushTool),
  { ssr: false }
);

const CoverCanvas = dynamic(
  () => import("./cover-canvas").then((m) => m.CoverCanvas),
  { ssr: false }
);

import type { Project, CustomFont } from "./types";

export function EditorShell({ project }: { project: Project }) {
  const router = useRouter();

  const stageRef = useRef<Konva.Stage>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number; width: number; minTop: number; maxBottom: number } | null>(null);

  const initialCanvas = useMemo(() => {
    const parsed = parseCanvasState(project.canvasState);
    if (parsed?.nodes?.length) return parsed;
    return getDefaultCanvasState(project.title, project.author);
  }, [project.canvasState, project.title, project.author]);

  const [nodes, setNodesRaw] = useState<CanvasNode[]>(initialCanvas.nodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Escape key to deselect
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedNodeId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setSelectedNodeId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId]);

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
  const [imageCount, setImageCount] = useState(() => {
    if (typeof window === "undefined") return 4;
    const saved = localStorage.getItem(`${IMAGE_COUNT_KEY_PREFIX}:${project.id}`);
    return saved ? Number(saved) : 4;
  });
  useEffect(() => {
    localStorage.setItem(`${IMAGE_COUNT_KEY_PREFIX}:${project.id}`, String(imageCount));
  }, [imageCount, project.id]);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [refPrompt, setRefPrompt] = useState("");
  const [refSubmitting, setRefSubmitting] = useState(false);
  const [brushMode, setBrushMode] = useState(false);
  const [inpaintPrompt, setInpaintPrompt] = useState("");
  const [inpaintMask, setInpaintMask] = useState<string | null>(null);
  const [inpaintSubmitting, setInpaintSubmitting] = useState(false);
  const [includeLayers, setIncludeLayers] = useState(false);
  const [layerPreviewUrl, setLayerPreviewUrl] = useState<string | null>(null);
  const [inpaintDialogOpen, setInpaintDialogOpen] = useState(false);
  const [activeGenerationIds, setActiveGenerationIds] = useState<string[]>([]);
  const [brushSize, setBrushSize] = useState(30);
  const [erasing, setErasing] = useState(false);
  const [hasBrushMask, setHasBrushMask] = useState(false);
  const brushToolRef = useRef<import("./brush-tool").BrushToolHandle>(null);
  const [model, setModel] = useState("openai");
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState(0); // 0=history, 1=queue
  const [keepLayersOnGenerate, setKeepLayersOnGenerate] = useState(true);
  const keepLayersRef = useRef(true);
  useEffect(() => { keepLayersRef.current = keepLayersOnGenerate; }, [keepLayersOnGenerate]);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [crossfadeSnapshot, setCrossfadeSnapshot] = useState<string | null>(null);
  const [kindleCrossfadeSnapshot, setKindleCrossfadeSnapshot] = useState<string | null>(null);
  const handleBgLoaded = useCallback(() => {
    setBgLoaded(true);
  }, []);
  const [kindlePreview, setKindlePreview] = useState<string | null>(null);
  const [showKindlePreview, setShowKindlePreview] = useState(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevImageCountRef = useRef(0);
  const pendingAutoSelectRef = useRef<string | null>(null);
  const layersCacheRef = useRef<Map<string, CanvasNode[]>>(new Map());

  // Asset and font state
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [defaultFont, setDefaultFont] = useState(DEFAULT_FONT);

  // Prevent page-level scroll while editor is mounted
  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  // Fetch attribute config, presets, project assets, and custom fonts
  useEffect(() => {
    async function init() {
      const results = await Promise.allSettled([
        getAttributeConfig(),
        getPresets(),
        getProjectAssets(project.id),
        listFonts(),
        getPreferences(),
      ]);
      if (results[0].status === "fulfilled") setAttributeConfig(results[0].value);
      if (results[1].status === "fulfilled") setPresets(results[1].value);
      if (results[2].status === "fulfilled") {
        const urls: Record<string, string> = {};
        for (const a of results[2].value) urls[a.id] = a.url;
        setAssetUrls(urls);
      }
      if (results[3].status === "fulfilled") {
        const fonts = results[3].value;
        setCustomFonts(fonts);
        await Promise.all(fonts.map((f) => loadCustomFont(f.family, f.url)));
      }
      if (results[4].status === "fulfilled") {
        const prefs = results[4].value;
        if (prefs.defaultFont) setDefaultFont(prefs.defaultFont);
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const completedGenerations = project.generations.filter(
    (g) => g.status === GENERATION_STATUS.COMPLETED
  );
  const allImages = completedGenerations.flatMap((g) => g.images);
  const pendingGenerations = project.generations.filter(
    (g) => g.status === GENERATION_STATUS.QUEUED || g.status === GENERATION_STATUS.PROCESSING
  );
  const allActiveIds = useMemo(
    () => [
      ...new Set([
        ...pendingGenerations.map((g) => g.id),
        ...activeGenerationIds,
      ]),
    ],
    [pendingGenerations, activeGenerationIds]
  );
  const activeGenerations = useMemo(() => {
    const fromProject = project.generations.filter(
      (g) => g.status === GENERATION_STATUS.QUEUED || g.status === GENERATION_STATUS.PROCESSING
    );
    const projectIds = new Set(fromProject.map((g) => g.id));
    const localOnly = activeGenerationIds
      .filter((id) => !projectIds.has(id))
      .map((id) => ({ id, status: GENERATION_STATUS.QUEUED, createdAt: new Date(), images: [] as never[] }));
    return [...fromProject, ...localOnly];
  }, [project.generations, activeGenerationIds]);
  const hasActiveGeneration = allActiveIds.length > 0;

  // Clear local tracking once project data confirms generation is done
  useEffect(() => {
    setActiveGenerationIds((prev) =>
      prev.filter(
        (id) =>
          !project.generations.some(
            (g) =>
              g.id === id &&
              (g.status === GENERATION_STATUS.COMPLETED || g.status === GENERATION_STATUS.FAILED)
          )
      )
    );
  }, [project.generations]);

  const selectedImageUrl = selectedImageId
    ? imageUrls[selectedImageId]
    : undefined;

  const selectedTextNode = selectedNodeId
    ? nodes.find((n): n is TextNodeConfig => n.id === selectedNodeId && n.type === NODE_TYPE.TEXT)
    : undefined;

  // Track canvas position for fixed-positioned toolbars (text above, inpaint below)
  useEffect(() => {
    if (!canvasContainerRef.current) {
      setToolbarPos(null);
      return;
    }
    const scrollParent = canvasContainerRef.current.closest(".overflow-auto");
    const update = () => {
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      const scrollRect = scrollParent?.getBoundingClientRect();
      if (rect) setToolbarPos({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        minTop: scrollRect?.top ?? 0,
        maxBottom: scrollRect?.bottom ?? window.innerHeight,
      });
    };
    update();
    scrollParent?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    let ro: ResizeObserver | undefined;
    if (scrollParent) {
      ro = new ResizeObserver(update);
      ro.observe(scrollParent);
    }
    return () => {
      scrollParent?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, []);

  // Helper: extract text nodes from a CanvasNode array
  const textNodes = nodes.filter((n): n is TextNodeConfig => n.type === NODE_TYPE.TEXT);

  // Resolve layers for an image: cache → DB persisted → project template
  const getLayersForImage = useCallback((imageId: string): CanvasNode[] => {
    const cached = layersCacheRef.current.get(imageId);
    if (cached) return cached;

    const img = allImages.find(i => i.id === imageId);
    if (img?.canvasState) {
      const parsed = parseCanvasState(img.canvasState);
      if (parsed?.nodes?.length) {
        layersCacheRef.current.set(imageId, parsed.nodes);
        return parsed.nodes;
      }
    }

    const template = structuredClone(initialCanvas.nodes);
    layersCacheRef.current.set(imageId, template);
    return template;
  }, [allImages, initialCanvas.nodes]);

  // Wrap setNodes to also update the per-image cache
  const selectedImageIdRef = useRef(selectedImageId);
  selectedImageIdRef.current = selectedImageId;

  const setNodes = useCallback((updater: CanvasNode[] | ((prev: CanvasNode[]) => CanvasNode[])) => {
    setNodesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (selectedImageIdRef.current) {
        layersCacheRef.current.set(selectedImageIdRef.current, next);
      }
      return next;
    });
  }, []);

  // Initialize per-image layers cache and set initial nodes
  useEffect(() => {
    for (const img of allImages) {
      if (img.canvasState && !layersCacheRef.current.has(img.id)) {
        const parsed = parseCanvasState(img.canvasState);
        if (parsed?.nodes?.length) {
          layersCacheRef.current.set(img.id, parsed.nodes);
        }
      }
    }

    const sel = allImages.find((img) => img.selected);
    const initialId = sel?.id ?? allImages[0]?.id ?? null;
    if (initialId) {
      const layers = getLayersForImage(initialId);
      // Pre-load fonts used in initial layers for Konva canvas
      const uniqueFonts = [...new Set(
        layers.filter((n): n is TextNodeConfig => n.type === NODE_TYPE.TEXT).map((n) => n.fontFamily)
      )];
      Promise.all(uniqueFonts.map(ensureFontLoaded));
      setSelectedImageId(initialId);
      setNodesRaw(layers);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (allImages.length === 0) return;

    const unfetched = allImages.filter((img) => !imageUrls[img.id]);
    if (unfetched.length === 0) return;

    let cancelled = false;
    const isInitialLoad = Object.keys(imageUrls).length === 0;
    if (isInitialLoad) setLoadingUrls(true);

    async function fetchUrls() {
      const newUrls: Record<string, string> = {};
      const results = await Promise.allSettled(
        unfetched.map((img) => getImageUrl(img.id))
      );
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") {
          newUrls[unfetched[i].id] = (results[i] as PromiseFulfilledResult<{ url: string }>).value.url;
        }
      }
      if (!cancelled) {
        setImageUrls((prev) => ({ ...prev, ...newUrls }));
        if (isInitialLoad) setLoadingUrls(false);
      }
    }
    fetchUrls();

    return () => { cancelled = true; };
  }, [allImages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect new images arriving → set pending auto-select
  useEffect(() => {
    const prevCount = prevImageCountRef.current;
    prevImageCountRef.current = allImages.length;

    if (allImages.length > prevCount && completedGenerations.length > 0) {
      const newestGen = completedGenerations[0]; // sorted createdAt desc
      if (newestGen?.images?.length > 0) {
        if (!keepLayersRef.current) {
          for (const img of newestGen.images) {
            layersCacheRef.current.set(img.id, []);
          }
        }
        pendingAutoSelectRef.current = newestGen.images[0].id;
      }
    }
  }, [allImages.length, completedGenerations]);

  // Auto-select once the URL becomes available
  useEffect(() => {
    const pendingId = pendingAutoSelectRef.current;
    if (pendingId && imageUrls[pendingId]) {
      pendingAutoSelectRef.current = null;
      selectImage(pendingId);
    }
  }, [imageUrls]); // eslint-disable-line react-hooks/exhaustive-deps


  // Auto-save canvas state (debounced 3s) — save to current image + project template
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    const imageIdToSave = selectedImageId;
    autoSaveTimerRef.current = setTimeout(() => {
      const canvasState: CanvasState = { nodes };

      // Save to current image
      if (imageIdToSave) {
        fireAndForget(updateImage(imageIdToSave, { canvasState }));
      }

      // Also update project-level template (default for new images)
      fireAndForget(updateProject(project.id, { canvasState }));
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [nodes, selectedImageId, project.id]);

  // Capture Kindle preview from canvas (debounced 500ms, only when image is loaded)
  const kindleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (kindleTimerRef.current) clearTimeout(kindleTimerRef.current);
    if (!bgLoaded) return;
    kindleTimerRef.current = setTimeout(() => {
      if (!stageRef.current) return;
      try {
        // Hide transformer so selection box doesn't appear in preview
        const tr = stageRef.current.findOne("Transformer");
        if (tr) tr.visible(false);
        stageRef.current.draw();
        const dataUrl = stageRef.current.toDataURL({
          pixelRatio: 0.3,
          mimeType: "image/jpeg",
          quality: 0.6,
        });
        if (tr) tr.visible(true);
        stageRef.current.draw();
        setKindlePreview(dataUrl);
      } catch {
        // canvas not ready
      }
    }, 500);
    return () => {
      if (kindleTimerRef.current) clearTimeout(kindleTimerRef.current);
    };
  }, [nodes, selectedImageUrl, bgLoaded]);

  const saveProject = useCallback(async () => {
    setSaving(true);
    try {
      const canvasState: CanvasState = { nodes };
      const titleNode = textNodes.find(n => n.id === "title") ?? textNodes[0];
      const titleText = titleNode?.text ?? project.title;
      const authorText = textNodes.find(n => n.id === "author")?.text ?? project.author;
      await updateProject(project.id, {
        title: titleText,
        author: authorText,
        attributes,
        brief: brief || null,
        canvasState,
      });
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [project.id, project.title, project.author, nodes, textNodes, attributes, brief]);

  async function selectImage(imageId: string) {
    if (imageId === selectedImageId) return;

    // Save current image's layers to cache and persist to server
    if (selectedImageId) {
      layersCacheRef.current.set(selectedImageId, nodes);
      const canvasState: CanvasState = { nodes };
      fireAndForget(updateImage(selectedImageId, { canvasState }));
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
    const uniqueFonts = [...new Set(
      newLayers.filter((n): n is TextNodeConfig => n.type === NODE_TYPE.TEXT).map((n) => n.fontFamily)
    )];
    await Promise.all(uniqueFonts.map(ensureFontLoaded));

    setNodesRaw(newLayers);
    setSelectedNodeId(null);
    setSelectedImageId(imageId);

    // Persist selection
    fireAndForget(updateImage(imageId, { selected: true }));
  }

  async function handleRegenerate() {
    try {
      const data = await createGeneration({
        projectId: project.id,
        imageCount,
        model,
        attributeSnapshot: attributes,
        textLayerSnapshot: textNodes.map((n) => ({
          name: n.name ?? n.id,
          text: n.text ?? "",
        })),
      });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setActiveTab(1);
      setPanelOpen(true);
      toast.success("Regeneration queued!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate");
    }
  }

  async function handleIncludeLayersChange(checked: boolean) {
    setIncludeLayers(checked);
    if (checked) {
      const url = await flattenCanvasToDataUrl();
      setLayerPreviewUrl(url ?? null);
    } else {
      setLayerPreviewUrl(null);
    }
  }

  async function flattenCanvasToDataUrl(): Promise<string | undefined> {
    const stage = stageRef.current;
    if (!stage) return undefined;
    setSelectedNodeId(null);
    await new Promise((r) => setTimeout(r, 50));
    await document.fonts.ready;
    const layers = stage.getLayers();
    // Hide extra layers (brush tool, selection, etc.) but keep text visible
    const hiddenLayers: Konva.Layer[] = [];
    for (let i = 2; i < layers.length; i++) {
      if (layers[i].visible()) {
        layers[i].visible(false);
        hiddenLayers.push(layers[i]);
      }
    }
    const dataUrl = stage.toDataURL({
      pixelRatio: KDP.width / CANVAS_WIDTH,
      mimeType: "image/jpeg",
      quality: 0.9,
    });
    for (const layer of hiddenLayers) {
      layer.visible(true);
    }
    return dataUrl;
  }

  async function handleGenerateSimilar() {
    if (!selectedImageId) return;
    setRefSubmitting(true);
    try {
      const flattenedImageDataUrl = includeLayers ? await flattenCanvasToDataUrl() : undefined;
      const data = await createGeneration({
        projectId: project.id,
        imageCount,
        model,
        referenceImageId: selectedImageId,
        flattenedImageDataUrl,
        attributeSnapshot: attributes,
        textLayerSnapshot: textNodes.map((n) => ({
          name: n.name ?? n.id,
          text: n.text ?? "",
        })),
      });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setActiveTab(1);
      setPanelOpen(true);
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
      const flattenedImageDataUrl = includeLayers ? await flattenCanvasToDataUrl() : undefined;
      const data = await createInpaint({
        imageId: selectedImageId,
        maskDataUrl: inpaintMask,
        prompt: inpaintPrompt,
        model,
        flattenedImageDataUrl,
        attributeSnapshot: attributes,
        textLayerSnapshot: textNodes.map((n) => ({
          name: n.name ?? n.id,
          text: n.text ?? "",
        })),
      });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setActiveTab(1);
      setPanelOpen(true);
      toast.success("Inpainting job queued!");
      setInpaintDialogOpen(false);
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

  const handleGenerationComplete = useCallback(
    (generationId: string) => {
      setActiveGenerationIds((prev) => {
        const next = prev.filter((id) => id !== generationId);
        if (next.length === 0) setActiveTab(0);
        return next;
      });
    },
    []
  );

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
        pixelRatio: KDP.width / CANVAS_WIDTH,
        mimeType: format === "jpeg" ? "image/jpeg" : "image/png",
        quality: format === "jpeg" ? 0.95 : undefined,
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      const titleNode = textNodes.find(n => n.id === "title") ?? textNodes[0];
      const titleText = titleNode?.text ?? "cover";
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
    fireAndForget(saveAttributeConfig(config));
  }

  async function handleSavePreset(name: string) {
    try {
      const preset = await createPreset(name, attributes);
      setPresets((prev) => [preset, ...prev]);
      setActivePresetId(preset.id);
      toast.success(`Preset "${name}" saved`);
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

  function updateNode(id: string, attrs: Partial<CanvasNode>) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    // For text nodes: rotation center adjustment when only rotation changes from sidebar
    if (node.type === NODE_TYPE.TEXT && attrs.rotation !== undefined && attrs.x === undefined && attrs.y === undefined) {
      setNodes(prev => prev.map(n => {
        if (n.id !== id || n.type !== NODE_TYPE.TEXT) return n;
        const oldRot = (n.rotation ?? 0) * Math.PI / 180;
        const newRot = attrs.rotation! * Math.PI / 180;
        const konvaNode = stageRef.current?.findOne(`#${id}`);
        const h = konvaNode ? (konvaNode as unknown as { height(): number }).height() / SCALE : 0;
        const w = konvaNode ? (konvaNode as unknown as { width(): number }).width() / SCALE : n.width;
        const cx = w / 2;
        const cy = h / 2;
        const dx = cx * (Math.cos(oldRot) - Math.cos(newRot)) - cy * (Math.sin(oldRot) - Math.sin(newRot));
        const dy = cx * (Math.sin(oldRot) - Math.sin(newRot)) + cy * (Math.cos(oldRot) - Math.cos(newRot));
        return { ...n, ...attrs, x: n.x + dx, y: n.y + dy } as TextNodeConfig;
      }));
      return;
    }
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...attrs } as CanvasNode : n));

    // When font changes, ensure it's loaded then redraw the Konva layer
    if ("fontFamily" in attrs && attrs.fontFamily) {
      ensureFontLoaded(attrs.fontFamily as string).then(() => {
        stageRef.current?.getLayers()[1]?.batchDraw();
      });
    }
  }

  function addTextNode() {
    const id = crypto.randomUUID();
    const newNode: TextNodeConfig = {
      type: NODE_TYPE.TEXT,
      id,
      name: "Text Layer",
      text: "New Text",
      x: 800,
      y: 1200,
      fontSize: 48,
      fontFamily: defaultFont,
      fill: "#ffffff",
      align: "center",
      fontStyle: "normal",
      width: 1280,
      visible: true,
      draggable: true,
      autoWidth: true,
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(id);
  }

  function addImageNode(asset: { id: string; width: number; height: number; url: string }) {
    const id = crypto.randomUUID();
    const maxW = 800;
    const scale = Math.min(1, maxW / (asset.width || 400));
    const newNode: ImageNodeConfig = {
      type: NODE_TYPE.IMAGE,
      id,
      name: "Image Layer",
      assetId: asset.id,
      x: 800 - (asset.width * scale) / 2,
      y: 1280 - (asset.height * scale) / 2,
      width: asset.width * scale,
      height: asset.height * scale,
      visible: true,
      draggable: true,
      opacity: 1,
    };
    setAssetUrls(prev => ({ ...prev, [asset.id]: asset.url }));
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(id);
  }

  function reorderNode(fromIndex: number, toIndex: number) {
    setNodes(prev => {
      if (fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function removeNode(id: string) {
    setNodes(prev => prev.filter(n => n.id !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  }

  function handleNodeDragEnd(id: string, x: number, y: number) {
    updateNode(id, { x: x / SCALE, y: y / SCALE });
  }

  function handleNodeTransformEnd(id: string, attrs: Partial<CanvasNode>) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const mapped: Partial<CanvasNode> = {};
    if (attrs.x !== undefined) mapped.x = attrs.x / SCALE;
    if (attrs.y !== undefined) mapped.y = attrs.y / SCALE;
    if (attrs.width !== undefined) mapped.width = attrs.width / SCALE;
    if (attrs.rotation !== undefined) mapped.rotation = attrs.rotation;

    if (node.type === NODE_TYPE.TEXT) {
      const textAttrs = attrs as Partial<TextNodeConfig>;
      if (textAttrs.fontSize !== undefined) (mapped as Partial<TextNodeConfig>).fontSize = textAttrs.fontSize / SCALE;
      if (textAttrs.autoWidth !== undefined) (mapped as Partial<TextNodeConfig>).autoWidth = textAttrs.autoWidth;
    }
    if (node.type === NODE_TYPE.IMAGE) {
      const imgAttrs = attrs as Partial<ImageNodeConfig>;
      if (imgAttrs.height !== undefined) (mapped as Partial<ImageNodeConfig>).height = imgAttrs.height / SCALE;
    }

    updateNode(id, mapped);
  }

  async function handleImageUpload(file: File) {
    try {
      const asset = await uploadAsset(file, project.id);

      // Get dimensions from browser Image API if server didn't provide them
      let { width, height } = asset;
      if (!width || !height) {
        const img = new window.Image();
        img.src = asset.url;
        await new Promise<void>((resolve) => {
          img.onload = () => {
            width = img.naturalWidth;
            height = img.naturalHeight;
            resolve();
          };
          img.onerror = () => resolve();
        });
      }

      addImageNode({ id: asset.id, width: width || 400, height: height || 400, url: asset.url });
      toast.success("Image added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleFontUpload(file: File) {
    try {
      const font = await uploadFont(file);
      await loadCustomFont(font.family, font.url);
      setCustomFonts(prev => {
        const existing = prev.findIndex(f => f.family === font.family);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = font;
          return updated;
        }
        return [...prev, font];
      });
      toast.success(`Font "${font.family}" added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Font upload failed");
    }
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
          saving={saving}
          onSave={saveProject}
        />
      </div>

      {/* Center: canvas + generation history */}
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
        <div
          className="flex flex-1 items-center justify-center overflow-auto scrollbar-hide p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedNodeId(null);
          }}
        >
          {/* Canvas + preview wrapper */}
          <div className="relative shrink-0">
          {/* Canvas */}
          <div ref={canvasContainerRef} className="relative shrink-0" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
            <div
              className="relative h-full w-full overflow-hidden rounded-xl border bg-background shadow-xl"
              style={brushMode && !inpaintMask ? { cursor: 'none' } : undefined}
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
                    nodes={nodes}
                    assetUrls={assetUrls}
                    selectedNodeId={brushMode ? null : selectedNodeId}
                    onSelectNode={brushMode ? () => {} : setSelectedNodeId}
                    onNodeDragEnd={handleNodeDragEnd}
                    onNodeTransformEnd={handleNodeTransformEnd}
                    stageRef={stageRef}
                    onImageLoad={handleBgLoaded}
                    hideCursor={brushMode && !inpaintMask}
                  />
                  {brushMode && !inpaintMask && (
                    <div className="absolute inset-0 z-20" style={{ cursor: "none", isolation: "isolate" }}>
                      <BrushTool
                        ref={brushToolRef}
                        onExportMask={(dataUrl) => {
                        setInpaintMask(dataUrl);
                        setInpaintDialogOpen(true);
                      }}
                        brushSize={brushSize}
                        erasing={erasing}
                        onHasMaskChange={setHasBrushMask}
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
            ) : hasActiveGeneration ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground/50" />
                <p className="font-medium text-muted-foreground">
                  Generation in progress
                </p>
                <p className="text-sm text-muted-foreground">
                  Check the Queue tab below
                </p>
              </div>
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
          </div>

          {/* Kindle preview — positioned to the right of canvas */}
          <KindlePreview
            show={showKindlePreview}
            onToggle={setShowKindlePreview}
            kindlePreview={kindlePreview}
            selectedImageUrl={selectedImageUrl}
            kindleCrossfadeSnapshot={kindleCrossfadeSnapshot}
            bgLoaded={bgLoaded}
            onCrossfadeEnd={() => setKindleCrossfadeSnapshot(null)}
          />
          </div>
        </div>

        {/* Bottom panel — Queue + History tabs */}
        <Collapsible
          open={panelOpen}
          onOpenChange={setPanelOpen}
          className="shrink-0 border-t bg-background/80"
        >
          <div className="flex items-center">
            <CollapsibleTrigger className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
              <ChevronRight
                className={`size-3.5 transition-transform duration-200 ${panelOpen ? "rotate-90" : ""}`}
              />
            </CollapsibleTrigger>
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v as number);
                setPanelOpen(true);
              }}
            >
              <TabsList variant="line">
                <TabsTrigger value={0}>
                  History
                  {completedGenerations.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                      {completedGenerations.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value={1}>
                  Queue
                  {allActiveIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                      {allActiveIds.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CollapsibleContent>
            {activeTab === 0 ? (
              <GenerationHistory
                generations={completedGenerations}
                imageUrls={imageUrls}
                selectedImageId={selectedImageId}
                onSelect={selectImage}
              />
            ) : (
              <GenerationQueue
                generations={activeGenerations}
                onComplete={handleGenerationComplete}
              />
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Right sidebar */}
      <div className="hidden lg:flex w-72 flex-col border-l bg-background">
        <RightSidebar
          nodes={nodes}
          assetUrls={assetUrls}
          customFonts={customFonts}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          updateNode={updateNode}
          addTextNode={addTextNode}
          removeNode={removeNode}
          reorderNode={reorderNode}
          onImageUpload={handleImageUpload}
          onFontUpload={handleFontUpload}
          hasSelectedImage={!!selectedImageUrl}
          onExportJpeg={() => handleExport("jpeg")}
          onExportPng={() => handleExport("png")}
          keepLayersOnGenerate={keepLayersOnGenerate}
          onKeepLayersOnGenerateChange={setKeepLayersOnGenerate}
        />
      </div>

      {/* Generate Similar Dialog */}
      <GenerateSimilarDialog
        open={refDialogOpen}
        onOpenChange={setRefDialogOpen}
        selectedImageUrl={selectedImageUrl}
        includeLayers={includeLayers}
        layerPreviewUrl={layerPreviewUrl}
        imageCount={imageCount}
        setImageCount={setImageCount}
        onIncludeLayersChange={handleIncludeLayersChange}
        refPrompt={refPrompt}
        setRefPrompt={setRefPrompt}
        submitting={refSubmitting}
        onSubmit={handleGenerateSimilar}
      />

      {/* Inpaint Dialog */}
      <InpaintDialog
        open={inpaintDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setInpaintDialogOpen(false);
            setBrushMode(false);
            setInpaintMask(null);
            setInpaintPrompt("");
          }
        }}
        selectedImageUrl={selectedImageUrl}
        includeLayers={includeLayers}
        layerPreviewUrl={layerPreviewUrl}
        inpaintMask={inpaintMask}
        inpaintPrompt={inpaintPrompt}
        setInpaintPrompt={setInpaintPrompt}
        onIncludeLayersChange={handleIncludeLayersChange}
        submitting={inpaintSubmitting}
        onSubmit={handleInpaintSubmit}
        onRepaint={() => {
          setInpaintMask(null);
          setInpaintDialogOpen(false);
        }}
        onCancel={() => {
          setInpaintDialogOpen(false);
          setBrushMode(false);
          setInpaintMask(null);
          setInpaintPrompt("");
        }}
      />

      {/* Fixed-position floating toolbar — rendered outside scroll container so it's never clipped */}
      {selectedTextNode && toolbarPos && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            top: Math.max(toolbarPos.minTop + 4, toolbarPos.top - 48),
            left: toolbarPos.left,
            width: toolbarPos.width,
          }}
        >
          <div className="pointer-events-auto flex justify-center">
            <TextFloatingToolbar
              node={selectedTextNode}
              onUpdate={(attrs) => updateNode(selectedTextNode.id, attrs)}
              customFonts={customFonts}
              onFontUpload={handleFontUpload}
            />
          </div>
        </div>
      )}

      {/* Fixed-position inpaint toolbar — overlays bottom of canvas */}
      {toolbarPos && selectedImageUrl && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            top: Math.min(toolbarPos.top + CANVAS_HEIGHT + 8, toolbarPos.maxBottom - 44),
            left: toolbarPos.left,
            width: toolbarPos.width,
          }}
        >
          <div className="pointer-events-auto flex justify-center">
            <InpaintToolbar
              brushMode={brushMode}
              setBrushMode={setBrushMode}
              selectedImageUrl={selectedImageUrl}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              erasing={erasing}
              setErasing={setErasing}
              onBrushUndo={() => brushToolRef.current?.undo()}
              onBrushClear={() => brushToolRef.current?.clear()}
              onBrushDone={() => brushToolRef.current?.export()}
              hasBrushMask={hasBrushMask}
              onRegenerate={handleRegenerate}
              activeGenerationCount={allActiveIds.length}
              onOpenSimilarDialog={() => setRefDialogOpen(true)}
              selectedImageId={selectedImageId}
              model={model}
              setModel={setModel}
              imageCount={imageCount}
              setImageCount={setImageCount}
            />
          </div>
        </div>
      )}
    </div>
  );
}
