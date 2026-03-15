"use client";

import { useRef, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Plus,
  Trash2,
  ImageIcon,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { CanvasNode, ImageNodeConfig } from "./canvas-types";
import { NODE_TYPE } from "./canvas-types";
import { TextLayerControls } from "./text-layer-controls";
import { ImageLayerControls } from "./image-layer-controls";
const BG_LAYER = "bg" as const;

interface LayerItem {
  id: string;
  name: string;
  type: "image" | "text" | typeof BG_LAYER;
  visible: boolean;
  locked: boolean;
  nodeIndex: number; // index in the nodes array (-1 for bg)
}

interface RightSidebarProps {
  nodes: CanvasNode[];
  assetUrls: Record<string, string>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  updateNode: (id: string, attrs: Partial<CanvasNode>) => void;
  addTextNode: () => void;
  removeNode: (id: string) => void;
  reorderNode: (fromIndex: number, toIndex: number) => void;
  onImageUpload: (file: File) => void;
  hasSelectedImage: boolean;
  onExportJpeg: () => void;
  onExportPng: () => void;
  keepLayersOnGenerate: boolean;
  onKeepLayersOnGenerateChange: (value: boolean) => void;
}

function getNodeLabel(node: CanvasNode) {
  if (node.type === NODE_TYPE.TEXT) return node.name || node.text || "Text Layer";
  return node.name || "Image Layer";
}

export function RightSidebar({
  nodes,
  assetUrls,
  selectedNodeId,
  setSelectedNodeId,
  updateNode,
  addTextNode,
  removeNode,
  reorderNode,
  onImageUpload,
  hasSelectedImage,
  onExportJpeg,
  onExportPng,
  keepLayersOnGenerate,
  onKeepLayersOnGenerateChange,
}: RightSidebarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Build layer items: non-bg nodes in reversed order (topmost layer first), then bg at bottom
  const nodeLayerItems: LayerItem[] = nodes
    .map((n, i) => ({
      id: n.id,
      name: getNodeLabel(n),
      type: n.type as "image" | "text",
      visible: n.visible,
      locked: !n.draggable,
      nodeIndex: i,
    }))
    .reverse();

  const layerItems: LayerItem[] = [
    ...nodeLayerItems,
    { id: BG_LAYER, name: "Background Image", type: BG_LAYER, visible: true, locked: true, nodeIndex: -1 },
  ];

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : undefined;

  function handleDragStart(e: React.DragEvent, visualIndex: number) {
    const layer = layerItems[visualIndex];
    if (layer.type === BG_LAYER) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(visualIndex);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, visualIndex: number) {
    e.preventDefault();
    const layer = layerItems[visualIndex];
    if (layer.type === BG_LAYER || draggedIndex === null) return;
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(visualIndex);
  }

  function handleDrop(e: React.DragEvent, visualIndex: number) {
    e.preventDefault();
    const layer = layerItems[visualIndex];
    if (layer.type === BG_LAYER || draggedIndex === null) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const fromLayer = layerItems[draggedIndex];
    const toLayer = layerItems[visualIndex];

    if (fromLayer && toLayer && fromLayer.nodeIndex !== -1 && toLayer.nodeIndex !== -1) {
      reorderNode(fromLayer.nodeIndex, toLayer.nodeIndex);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Properties</h2>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {/* Layers section */}
          <Label className="px-2 text-sm text-muted-foreground uppercase tracking-wider">
            Layers
          </Label>
          <div className="mt-1 divide-y">
            {layerItems.map((layer, visualIndex) => (
              <div
                key={layer.id}
                draggable={layer.type !== "bg"}
                onDragStart={(e) => handleDragStart(e, visualIndex)}
                onDragOver={(e) => handleDragOver(e, visualIndex)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleDrop(e, visualIndex)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-1.5 py-1.5 px-1 cursor-pointer transition-colors ${
                  selectedNodeId === layer.id
                    ? "bg-primary/5"
                    : "hover:bg-muted/50"
                } ${
                  dragOverIndex === visualIndex && draggedIndex !== visualIndex
                    ? "border-t-2 border-primary"
                    : ""
                } ${
                  draggedIndex === visualIndex ? "opacity-40" : ""
                }`}
                onClick={() => {
                  if (layer.type !== "bg") setSelectedNodeId(layer.id);
                  else setSelectedNodeId(null);
                }}
              >
                <GripVertical
                  className={`size-3 shrink-0 ${
                    layer.type === BG_LAYER
                      ? "text-muted-foreground/20"
                      : "text-muted-foreground/50 cursor-grab active:cursor-grabbing"
                  }`}
                />
                <div className="flex w-4 items-center justify-center text-xs text-muted-foreground shrink-0">
                  {layer.type === NODE_TYPE.IMAGE || layer.type === BG_LAYER ? (
                    <ImageIcon className="size-3" />
                  ) : (
                    "T"
                  )}
                </div>
                <span className="flex-1 text-sm truncate">{layer.name}</span>
                {layer.type !== BG_LAYER && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateNode(layer.id, { visible: !layer.visible });
                      }}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {layer.visible ? (
                        <Eye className="size-3" />
                      ) : (
                        <EyeOff className="size-3" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateNode(layer.id, { draggable: layer.locked });
                      }}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {layer.locked ? (
                        <Lock className="size-3" />
                      ) : (
                        <Unlock className="size-3" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNode(layer.id);
                      }}
                      className="p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="px-1 py-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={addTextNode}
            >
              <Plus className="size-3.5" />
              Add Text
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => imageInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Add Image
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImageUpload(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex items-center justify-between px-2 py-1">
            <Label htmlFor="keep-layers" className="text-xs">Keep layers on new generations</Label>
            <Switch id="keep-layers" checked={keepLayersOnGenerate} onCheckedChange={onKeepLayersOnGenerateChange} />
          </div>
        </div>

        <Separator />

        {/* Properties section — conditional on selected node type */}
        <div className="p-4">
          <Label className="text-sm text-muted-foreground uppercase tracking-wider">
            {selectedNode ? (selectedNode.type === NODE_TYPE.IMAGE ? "Image Properties" : "Text Properties") : "Layer Properties"}
          </Label>
          <div className="mt-2">
            {selectedNode ? (
              selectedNode.type === NODE_TYPE.TEXT ? (
                <TextLayerControls
                  node={selectedNode}
                  onUpdate={(attrs) => updateNode(selectedNode.id, attrs)}
                  onRemove={() => removeNode(selectedNode.id)}
                />
              ) : (
                <ImageLayerControls
                  node={selectedNode as ImageNodeConfig}
                  onUpdate={(attrs) => updateNode(selectedNode.id, attrs)}
                  onRemove={() => removeNode(selectedNode.id)}
                  assetUrl={assetUrls[(selectedNode as ImageNodeConfig).assetId]}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Select a layer to edit
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Footer — sticky bottom */}
      <div className="space-y-2 border-t p-4">
        <Button
          className="w-full gap-2"
          onClick={onExportJpeg}
          disabled={!hasSelectedImage}
        >
          <Download className="size-4" />
          Export JPEG (KDP-Ready)
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onExportPng}
          disabled={!hasSelectedImage}
        >
          <Download className="size-4" />
          Export PNG
        </Button>
      </div>
    </div>
  );
}
