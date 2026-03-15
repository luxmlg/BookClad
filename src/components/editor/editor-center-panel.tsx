"use client";

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
import type { CanvasNode } from "./canvas-types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./canvas-types";
import { GenerationHistory } from "./generation-history";
import { GenerationQueue } from "./generation-queue";
import { KindlePreview } from "./kindle-preview";
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
  setInpaintDialogOpen: (open: boolean) => void;
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

  // Bottom panel
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  completedGenerations: Generation[];
  selectedImageId: string | null;
  selectImage: (id: string) => void;
  allActiveIds: string[];
  activeGenerations: Generation[];
  handleGenerationComplete: (generationId: string) => void;
}

export function EditorCenterPanel({
  nodes,
  assetUrls,
  selectedNodeId,
  setSelectedNodeId,
  handleNodeDragEnd,
  handleNodeTransformEnd,
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
  setInpaintDialogOpen,
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
  panelOpen,
  setPanelOpen,
  activeTab,
  setActiveTab,
  completedGenerations,
  selectedImageId,
  selectImage,
  allActiveIds,
  activeGenerations,
  handleGenerationComplete,
}: EditorCenterPanelProps) {
  return (
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

      {/* Bottom panel */}
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
  );
}
