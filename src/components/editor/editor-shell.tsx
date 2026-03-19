"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type Konva from "konva";
import type { TextNodeConfig, ImageNodeConfig, CanvasNode, CanvasState } from "./canvas-types";
import { getDefaultCanvasState, parseCanvasState, CANVAS_WIDTH, CANVAS_HEIGHT, SCALE, NODE_TYPE } from "./canvas-types";
import { KDP, GENERATION_STATUS } from "@/lib/constants";
import { DEFAULT_FONT, ensureFontLoaded, loadCustomFont } from "@/lib/fonts";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";
import { TextFloatingToolbar } from "./text-floating-toolbar";
import { InpaintToolbar } from "./inpaint-toolbar";
import { EditorCenterPanel } from "./editor-center-panel";
import type { AttributeConfigJson, AttributeSelection } from "@/lib/attributes";
import { buildDefaultConfig, computeAttributeDiff } from "@/lib/attributes";
import {
  getAttributeConfig,
  saveAttributeConfig,
  getPresets,
  getProjectAssets,
  listFonts,
  getPreferences,
  updateImage,
  updateProject,
  uploadAsset,
  uploadFont,
  createPreset,
  fireAndForget,
} from "@/lib/api";
import { asAttributeSnapshot, type Project, type CustomFont } from "./types";
import {
  useLayerCache,
  useAutoSave,
  useToolbarPosition,
  useKindlePreview,
  useImageUrls,
} from "./hooks";
import { useInpaintState } from "./use-inpaint-state";
import { useGenerationActions } from "./use-generation-actions";
import { useCreditStore } from "@/lib/stores/credit-store";

interface EditorShellProps {
  project: Project;
  showPrompt: boolean;
}

export function EditorShell({ project, showPrompt }: EditorShellProps) {
  const router = useRouter();

  const stageRef = useRef<Konva.Stage>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const initialCanvas = useMemo(() => {
    const parsed = parseCanvasState(project.canvasState);
    if (parsed?.nodes?.length) return parsed;
    return getDefaultCanvasState(project.title, project.author);
  }, [project.canvasState, project.title, project.author]);

  const completedGenerations = project.generations.filter(
    (g) => g.status === GENERATION_STATUS.COMPLETED
  );
  const allImages = completedGenerations.flatMap((g) => g.images);

  // ── Hooks ─────────────────────────────────────────────────
  const { layersCacheRef, getLayersForImage, setNodes, setNodesRaw, nodes, selectedImageIdRef } =
    useLayerCache(allImages, initialCanvas);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  // Keep layer cache in sync with selected image
  useEffect(() => {
    selectedImageIdRef.current = selectedImageId;
  }, [selectedImageId, selectedImageIdRef]);

  const { imageUrls, loadingUrls } = useImageUrls(allImages);
  const toolbarPos = useToolbarPosition(canvasContainerRef);

  const [attributes, setAttributes] = useState<AttributeSelection>(
    (project.attributes as AttributeSelection | null) ?? {}
  );
  const [baseSnapshot, setBaseSnapshot] = useState<AttributeSelection | null>(null);
  const draftStashRef = useRef<Map<string, AttributeSelection>>(new Map());

  const draftKeys: Set<string> = useMemo(() => {
    if (!baseSnapshot) return new Set<string>();
    const diffs = computeAttributeDiff(attributes, baseSnapshot);
    return new Set(diffs?.map((d) => d.key) ?? []);
  }, [attributes, baseSnapshot]);

  // Set of image IDs that have draft edits (stashed or live)
  const draftImageIds: Set<string> = useMemo(() => {
    const ids = new Set(draftStashRef.current.keys());
    if (selectedImageId && draftKeys.size > 0) ids.add(selectedImageId);
    if (selectedImageId && draftKeys.size === 0) ids.delete(selectedImageId);
    return ids;
  }, [selectedImageId, draftKeys]);

  const discardAllDrafts = useCallback(() => {
    if (!baseSnapshot) return;
    setAttributes(baseSnapshot);
    if (selectedImageId) draftStashRef.current.delete(selectedImageId);
  }, [baseSnapshot, selectedImageId]);

  const discardAttributeDraft = useCallback((key: string) => {
    if (!baseSnapshot || !(key in baseSnapshot)) return;
    setAttributes((prev) => ({ ...prev, [key]: baseSnapshot[key] }));
  }, [baseSnapshot]);
  const [attributeConfig, setAttributeConfig] = useState<AttributeConfigJson>(
    buildDefaultConfig()
  );
  const [presets, setPresets] = useState<
    Array<{ id: string; name: string; attributes: AttributeSelection }>
  >([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const refreshCredits = useCreditStore((s) => s.refreshCredits);

  const [keepLayersOnGenerate, setKeepLayersOnGenerate] = useState(true);
  const keepLayersRef = useRef(true);
  useEffect(() => { keepLayersRef.current = keepLayersOnGenerate; }, [keepLayersOnGenerate]);

  const [bgLoaded, setBgLoaded] = useState(false);
  const [crossfadeSnapshot, setCrossfadeSnapshot] = useState<string | null>(null);
  const [kindleCrossfadeSnapshot, setKindleCrossfadeSnapshot] = useState<string | null>(null);
  const handleBgLoaded = useCallback(() => { setBgLoaded(true); }, []);
  const [showKindlePreview, setShowKindlePreview] = useState(true);

  const prevImageCountRef = useRef(0);
  const pendingAutoSelectRef = useRef<string | null>(null);

  // Asset and font state
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [defaultFont, setDefaultFont] = useState(DEFAULT_FONT);

  // Derived
  const textNodes = nodes.filter((n): n is TextNodeConfig => n.type === NODE_TYPE.TEXT);
  const selectedImageUrl = selectedImageId ? imageUrls[selectedImageId] : undefined;
  const selectedTextNode = selectedNodeId
    ? nodes.find((n): n is TextNodeConfig => n.id === selectedNodeId && n.type === NODE_TYPE.TEXT)
    : undefined;

  // Forward ref for inpaint — allows genActions to read live inpaint state in handlers
  const inpaintRef = useRef<{ includeLayers: boolean; flattenCanvasToDataUrl: () => Promise<string | undefined> }>({
    includeLayers: false,
    flattenCanvasToDataUrl: async () => undefined,
  });

  // Generation actions (created first with ref — only reads inpaint in event handlers)
  const genActions = useGenerationActions(
    project.id, project.generations,
    attributes, nodes, selectedImageId,
    inpaintRef, router,
  );

  // Wrap generation complete to also refresh credits
  const { handleGenerationComplete } = genActions;
  const handleGenerationCompleteWithCredits = useCallback(
    (generationId: string) => {
      handleGenerationComplete(generationId);
      refreshCredits();
    },
    [handleGenerationComplete, refreshCredits]
  );

  // Inpaint state (uses genActions' stable setters)
  const inpaint = useInpaintState(
    stageRef, selectedImageId, setSelectedNodeId,
    genActions.setActiveGenerationIds,
    genActions.setActiveTab,
    genActions.setPanelOpen,
    genActions.model,
    attributes, nodes, router,
  );

  // Keep inpaint ref in sync
  inpaintRef.current = inpaint;

  // Auto-save
  useAutoSave(nodes, selectedImageId, project.id);

  // Kindle preview
  const kindlePreview = useKindlePreview(stageRef, nodes, selectedImageUrl, bgLoaded);

  // ── Effects ───────────────────────────────────────────────

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

  // Prevent page-level scroll
  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = ""; };
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
      // Refresh credits from store to ensure latest balance
      refreshCredits();
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


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
      const uniqueFonts = [...new Set(
        layers.filter((n): n is TextNodeConfig => n.type === NODE_TYPE.TEXT).map((n) => n.fontFamily)
      )];
      Promise.all(uniqueFonts.map(ensureFontLoaded));
      setSelectedImageId(initialId);
      setNodesRaw(layers);

      const ownerGen = completedGenerations.find((g) =>
        g.images.some((img) => img.id === initialId)
      );
      setBaseSnapshot(ownerGen ? asAttributeSnapshot(ownerGen.attributeSnapshot) : null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect new images arriving
  useEffect(() => {
    const prevCount = prevImageCountRef.current;
    prevImageCountRef.current = allImages.length;

    if (allImages.length > prevCount && completedGenerations.length > 0) {
      const newestGen = completedGenerations[0];
      if (newestGen?.images?.length > 0) {
        const layersWereBakedIn = newestGen.includeLayers === true;
        if (!keepLayersRef.current) {
          for (const img of newestGen.images) {
            layersCacheRef.current.set(img.id, []);
          }
        } else if (layersWereBakedIn) {
          const hiddenNodes = nodes.filter(n => !n.visible);
          for (const img of newestGen.images) {
            layersCacheRef.current.set(img.id, hiddenNodes);
          }
        }
        pendingAutoSelectRef.current = newestGen.images[0].id;
      }
    }
  }, [allImages.length, completedGenerations, layersCacheRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select once URL becomes available
  useEffect(() => {
    const pendingId = pendingAutoSelectRef.current;
    if (pendingId && imageUrls[pendingId]) {
      pendingAutoSelectRef.current = null;
      selectImage(pendingId);
    }
  }, [imageUrls]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────

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
        canvasState,
      });
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [project.id, project.title, project.author, nodes, textNodes, attributes]);

  async function selectImage(imageId: string) {
    if (imageId === selectedImageId) return;

    if (selectedImageId) {
      layersCacheRef.current.set(selectedImageId, nodes);
      const canvasState: CanvasState = { nodes };
      fireAndForget(updateImage(selectedImageId, { canvasState }));

      // Stash current attributes if they differ from baseSnapshot
      if (baseSnapshot) {
        const diffs = computeAttributeDiff(attributes, baseSnapshot);
        if (diffs && diffs.length > 0) {
          draftStashRef.current.set(selectedImageId, attributes);
        } else {
          draftStashRef.current.delete(selectedImageId);
        }
      }
    }

    const newLayers = getLayersForImage(imageId);

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
    const currentKindleSrc = kindlePreview ?? selectedImageUrl ?? null;
    if (currentKindleSrc) setKindleCrossfadeSnapshot(currentKindleSrc);

    const uniqueFonts = [...new Set(
      newLayers.filter((n): n is TextNodeConfig => n.type === NODE_TYPE.TEXT).map((n) => n.fontFamily)
    )];
    await Promise.all(uniqueFonts.map(ensureFontLoaded));

    setNodesRaw(newLayers);
    setSelectedNodeId(null);
    setSelectedImageId(imageId);
    fireAndForget(updateImage(imageId, { selected: true }));

    // Resolve base snapshot for the new image
    const ownerGen = completedGenerations.find((g) =>
      g.images.some((img) => img.id === imageId)
    );
    const genSnap = ownerGen ? asAttributeSnapshot(ownerGen.attributeSnapshot) : null;

    // Restore stashed drafts if any, otherwise restore generation snapshot
    const stashed = draftStashRef.current.get(imageId);
    if (stashed) {
      setAttributes(stashed);
    } else if (genSnap) {
      setAttributes(genSnap);
    }

    setBaseSnapshot(genSnap);
    setActivePresetId(null);
  }

  async function handleExport(format: "jpeg" | "png") {
    if (!stageRef.current) {
      toast.error("No canvas to export");
      return;
    }
    try {
      setSelectedNodeId(null);
      await new Promise((r) => setTimeout(r, 50));
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
      const textAttributeIds = new Set(
        attributeConfig.attributes.filter((c) => c.type === "text").map((c) => c.id),
      );
      const presetAttrs = Object.fromEntries(
        Object.entries(attributes).filter(([key]) => !textAttributeIds.has(key)),
      );
      const preset = await createPreset(name, presetAttrs);
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
      let { width, height } = asset;
      if (!width || !height) {
        const img = new window.Image();
        img.src = asset.url;
        await new Promise<void>((resolve) => {
          img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; resolve(); };
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

  // ── Render ────────────────────────────────────────────────

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
          saving={saving}
          onSave={saveProject}
          draftKeys={draftKeys}
          onDiscardAttributeDraft={discardAttributeDraft}
        />
      </div>

      {/* Center */}
      <EditorCenterPanel
        nodes={nodes}
        assetUrls={assetUrls}
        selectedNodeId={selectedNodeId}
        setSelectedNodeId={setSelectedNodeId}
        handleNodeDragEnd={handleNodeDragEnd}
        handleNodeTransformEnd={handleNodeTransformEnd}
        stageRef={stageRef}
        canvasContainerRef={canvasContainerRef}
        handleBgLoaded={handleBgLoaded}
        selectedImageUrl={selectedImageUrl}
        imageUrls={imageUrls}
        loadingUrls={loadingUrls}
        allImagesLength={allImages.length}
        brushMode={inpaint.brushMode}
        inpaintMask={inpaint.inpaintMask}
        brushSize={inpaint.brushSize}
        erasing={inpaint.erasing}
        brushToolRef={inpaint.brushToolRef}
        setInpaintMask={inpaint.setInpaintMask}
        setHasBrushMask={inpaint.setHasBrushMask}
        crossfadeSnapshot={crossfadeSnapshot}
        bgLoaded={bgLoaded}
        setCrossfadeSnapshot={setCrossfadeSnapshot}
        kindlePreview={kindlePreview}
        showKindlePreview={showKindlePreview}
        setShowKindlePreview={setShowKindlePreview}
        kindleCrossfadeSnapshot={kindleCrossfadeSnapshot}
        setKindleCrossfadeSnapshot={setKindleCrossfadeSnapshot}
        hasActiveGeneration={genActions.hasActiveGeneration}
        handleRegenerate={genActions.handleRegenerate}
        panelOpen={genActions.panelOpen}
        setPanelOpen={genActions.setPanelOpen}
        activeTab={genActions.activeTab}
        setActiveTab={genActions.setActiveTab}
        completedGenerations={completedGenerations}
        selectedImageId={selectedImageId}
        selectImage={selectImage}
        allActiveIds={genActions.allActiveIds}
        activeGenerations={genActions.activeGenerations}
        handleGenerationComplete={handleGenerationCompleteWithCredits}
        showPrompt={showPrompt}
        draftImageIds={draftImageIds}
        onDiscardDrafts={discardAllDrafts}
        onGenerateMore={genActions.handleGenerateMore}
      />

      {/* Right sidebar */}
      <div className="hidden lg:flex w-72 flex-col border-l bg-background">
        <RightSidebar
          nodes={nodes}
          assetUrls={assetUrls}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          updateNode={updateNode}
          addTextNode={addTextNode}
          removeNode={removeNode}
          reorderNode={reorderNode}
          onImageUpload={handleImageUpload}
          hasSelectedImage={!!selectedImageUrl}
          onExportJpeg={() => handleExport("jpeg")}
          onExportPng={() => handleExport("png")}
          keepLayersOnGenerate={keepLayersOnGenerate}
          onKeepLayersOnGenerateChange={setKeepLayersOnGenerate}
        />
      </div>

      {/* Fixed-position floating toolbar */}
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

      {/* Fixed-position inpaint toolbar */}
      {toolbarPos && selectedImageUrl && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            top: Math.min(toolbarPos.top + CANVAS_HEIGHT + 8, toolbarPos.maxBottom - 44),
            left: toolbarPos.left + toolbarPos.width / 2,
            transform: "translateX(-50%)",
          }}
        >
          <div className="pointer-events-auto">
            <InpaintToolbar
              brushMode={inpaint.brushMode}
              setBrushMode={inpaint.setBrushMode}
              selectedImageUrl={selectedImageUrl}
              brushSize={inpaint.brushSize}
              setBrushSize={inpaint.setBrushSize}
              erasing={inpaint.erasing}
              setErasing={inpaint.setErasing}
              onBrushUndo={() => inpaint.brushToolRef.current?.undo()}
              onBrushClear={() => inpaint.brushToolRef.current?.clear()}
              onBrushDone={() => inpaint.brushToolRef.current?.export()}
              hasBrushMask={inpaint.hasBrushMask}
              onRegenerate={genActions.handleRegenerate}
              activeGenerationCount={genActions.allActiveIds.length}
              selectedImageId={selectedImageId}
              inpaintMask={inpaint.inpaintMask}
              inpaintSubmitting={inpaint.inpaintSubmitting}
              onInpaintSubmit={inpaint.handleInpaintSubmit}
              onCancelInpaint={() => {
                inpaint.setBrushMode(false);
                inpaint.setInpaintMask(null);
              }}
              onRepaint={() => inpaint.setInpaintMask(null)}
              onGenerateSimilar={genActions.handleGenerateSimilar}
              includeLayers={inpaint.includeLayers}
              onIncludeLayersChange={inpaint.handleIncludeLayersChange}
              model={genActions.model}
              setModel={genActions.setModel}
              imageCount={genActions.imageCount}
              setImageCount={genActions.setImageCount}
            />
          </div>
        </div>
      )}
    </div>
  );
}
