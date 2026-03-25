"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Loader2,
  ImageIcon,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { CanvasNode } from "./canvas-types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./canvas-types";
import { GenerationHistory } from "./generation-history";
import { GenerationQueue } from "./generation-queue";
import { KindlePreview } from "./kindle-preview";
import { AI_MODELS } from "@/lib/constants";
import type Konva from "konva";
import type { Generation } from "./types";

const BrushTool = dynamic(
  () => import("./brush-tool").then((m) => m.BrushTool),
  { ssr: false }
);

const CoverCanvas = dynamic(
  () => import("./cover-canvas").then((m) => m.CoverCanvas),
  { ssr: false }
);

interface EditorCenterPanelProps {
  // Canvas
  nodes: CanvasNode[];
  assetUrls: Record<string, string>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  handleNodeDragEnd: (id: string, x: number, y: number) => void;
  handleNodeTransformEnd: (id: string, attrs: Partial<CanvasNode>) => void;
  handleTextEdit: (id: string, newText: string) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  handleBgLoaded: () => void;

  // Image state
  selectedImageUrl: string | undefined;
  imageUrls: Record<string, string>;
  loadingUrls: boolean;
  allImagesLength: number;

  // Brush / inpaint
  brushMode: boolean;
  inpaintMask: string | null;
  brushSize: number;
  erasing: boolean;
  brushToolRef: React.RefObject<import("./brush-tool").BrushToolHandle | null>;
  setInpaintMask: (mask: string | null) => void;
  setHasBrushMask: (has: boolean) => void;

  // Crossfade
  crossfadeSnapshot: string | null;
  bgLoaded: boolean;
  setCrossfadeSnapshot: (s: string | null) => void;

  // Kindle preview
  kindlePreview: string | null;
  showKindlePreview: boolean;
  setShowKindlePreview: (show: boolean) => void;
  kindleCrossfadeSnapshot: string | null;
  setKindleCrossfadeSnapshot: (s: string | null) => void;

  // Generation state
  hasActiveGeneration: boolean;
  handleRegenerate: () => void;
  model: string;
  setModel: (model: string) => void;
  imageCount: number;
  setImageCount: (count: number) => void;

  // Bottom panel
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  completedGenerations: Generation[];
  historyGenerations: Generation[];
  pendingSlotCounts: Map<string, number>;
  activeIdSet: Set<string>;
  selectedImageId: string | null;
  selectImage: (id: string) => void;
  allActiveIds: string[];
  activeGenerations: Generation[];
  handleGenerationComplete: (generationId: string) => void;
  showPrompt: boolean;
  draftImageIds: Set<string>;
  unseenImageIds: Set<string>;
  onDiscardDrafts: () => void;
  onGenerateMore: (generation: Generation, imageCount: number) => Promise<void>;
  onDeletedImages: (deletedIds: string[], removedGenerationIds: string[]) => void;
}

export function EditorCenterPanel({
  nodes,
  assetUrls,
  selectedNodeId,
  setSelectedNodeId,
  handleNodeDragEnd,
  handleNodeTransformEnd,
  handleTextEdit,
  stageRef,
  canvasContainerRef,
  handleBgLoaded,
  selectedImageUrl,
  imageUrls,
  loadingUrls,
  allImagesLength,
  brushMode,
  inpaintMask,
  brushSize,
  erasing,
  brushToolRef,
  setInpaintMask,
  setHasBrushMask,
  crossfadeSnapshot,
  bgLoaded,
  setCrossfadeSnapshot,
  kindlePreview,
  showKindlePreview,
  setShowKindlePreview,
  kindleCrossfadeSnapshot,
  setKindleCrossfadeSnapshot,
  hasActiveGeneration,
  handleRegenerate,
  model,
  setModel,
  imageCount,
  setImageCount,
  panelOpen,
  setPanelOpen,
  activeTab,
  setActiveTab,
  completedGenerations,
  historyGenerations,
  pendingSlotCounts,
  activeIdSet,
  selectedImageId,
  selectImage,
  allActiveIds,
  activeGenerations,
  handleGenerationComplete,
  showPrompt,
  draftImageIds,
  unseenImageIds,
  onDiscardDrafts,
  onGenerateMore,
  onDeletedImages,
}: EditorCenterPanelProps) {
  const STORAGE_KEY = "bookclad:panel-height";
  const MIN_HEIGHT = 100;
  const MAX_HEIGHT = 600;
  const DEFAULT_HEIGHT = 280;

  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = Number(stored);
      if (n >= MIN_HEIGHT && n <= MAX_HEIGHT) setPanelHeight(n);
    }
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;

    const onMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, containerRect.bottom - ev.clientY),
      );
      setPanelHeight(newHeight);
    };

    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setPanelHeight((h) => {
        localStorage.setItem(STORAGE_KEY, String(h));
        return h;
      });
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden bg-muted/20">
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
          {allImagesLength > 0 ? (
            loadingUrls || Object.keys(imageUrls).length === 0 ? (
              <Skeleton className="h-full w-full rounded-none" />
            ) : selectedImageUrl ? (
              <>
                {/* Crossfade overlay */}
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
                  onTextEdit={brushMode ? undefined : handleTextEdit}
                  stageRef={stageRef}
                  onImageLoad={handleBgLoaded}
                  hideCursor={brushMode && !inpaintMask}
                />
                {brushMode && !inpaintMask && (
                  <div className="absolute inset-0 z-20" style={{ cursor: "none", isolation: "isolate" }}>
                    <BrushTool
                      ref={brushToolRef}
                      onExportMask={setInpaintMask}
                      brushSize={brushSize}
                      erasing={erasing}
                      onHasMaskChange={setHasBrushMask}
                    />
                  </div>
                )}
                {inpaintMask && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inpaintMask}
                    alt=""
                    className="absolute inset-0 z-20 h-full w-full object-cover opacity-40 pointer-events-none"
                  />
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
                Your images will appear below
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <ImageIcon className="size-12 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">
                No generated images yet
              </p>
              <div className="flex items-center gap-3">
                <Select value={model} onValueChange={(v) => v && setModel(v)}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue>
                      {AI_MODELS.find((m) => m.value === model)?.label ?? "Model"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(imageCount)} onValueChange={(v) => v && setImageCount(Number(v))}>
                  <SelectTrigger className="h-8 w-[100px] text-xs">
                    <SelectValue>
                      {imageCount} {imageCount === 1 ? "image" : "images"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 4, 8].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? "image" : "images"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="default" size="sm" onClick={handleRegenerate}>
                  <RefreshCw className="mr-2 size-3.5" />
                  Generate
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Kindle preview */}
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

      {/* Resize handle */}
      {panelOpen && (
        <div
          className="h-1 shrink-0 cursor-row-resize border-t bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors"
          onMouseDown={startResize}
          onDoubleClick={() => {
            setPanelHeight(DEFAULT_HEIGHT);
            localStorage.setItem(STORAGE_KEY, String(DEFAULT_HEIGHT));
          }}
        />
      )}

      {/* Bottom panel */}
      <Collapsible
        open={panelOpen}
        onOpenChange={setPanelOpen}
        className={`shrink-0 bg-background/80 ${panelOpen ? "" : "border-t"}`}
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
                {historyGenerations.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                    {historyGenerations.length}
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
          <div style={{ height: panelHeight }} className="overflow-y-auto">
          <div className={activeTab !== 0 ? "hidden" : undefined}>
            <GenerationHistory
              generations={historyGenerations}
              imageUrls={imageUrls}
              selectedImageId={selectedImageId}
              onSelect={selectImage}
              showPrompt={showPrompt}
              draftImageIds={draftImageIds}
              onDiscardDrafts={onDiscardDrafts}
              onGenerateMore={onGenerateMore}
              activeIds={activeIdSet}
              pendingSlotCounts={pendingSlotCounts}
              unseenImageIds={unseenImageIds}
              onDeletedImages={onDeletedImages}
            />
          </div>
          <div className={activeTab !== 1 ? "hidden" : undefined}>
            <GenerationQueue
              generations={activeGenerations}
              onComplete={handleGenerationComplete}
            />
          </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
