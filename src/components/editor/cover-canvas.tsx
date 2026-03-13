"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Text,
  Transformer,
  Line,
} from "react-konva";
import type Konva from "konva";
import { migrateFont } from "@/lib/fonts";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 640;
const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 2560;
const SCALE = CANVAS_WIDTH / EXPORT_WIDTH;

export interface TextNodeConfig {
  id: string;
  name?: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: "left" | "center" | "right";
  fontStyle: string;
  width: number;
  visible: boolean;
  draggable: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface CanvasState {
  textNodes: TextNodeConfig[];
}

interface LegacyCanvasState {
  titleNode: TextNodeConfig;
  authorNode: TextNodeConfig;
  subtitleNode?: TextNodeConfig;
}

export function migrateCanvasState(raw: unknown): CanvasState | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.textNodes)) {
    const state = obj as unknown as CanvasState;
    state.textNodes = state.textNodes.map((n) => ({
      ...n,
      fontFamily: migrateFont(n.fontFamily),
    }));
    return state;
  }
  // Legacy shape
  if (obj.titleNode && obj.authorNode) {
    const legacy = obj as unknown as LegacyCanvasState;
    const idToName: Record<string, string> = { title: "Title", subtitle: "Subtitle", author: "Author" };
    const withName = (n: TextNodeConfig) => ({
      ...n,
      name: n.name ?? idToName[n.id] ?? n.id,
      fontFamily: migrateFont(n.fontFamily),
    });
    const nodes = [withName(legacy.titleNode), withName(legacy.authorNode)];
    if (legacy.subtitleNode) nodes.splice(1, 0, withName(legacy.subtitleNode));
    return { textNodes: nodes };
  }
  return null;
}

interface Guide {
  x?: number;
  y?: number;
}

interface CoverCanvasProps {
  imageUrl: string | undefined;
  textNodes: TextNodeConfig[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onNodeDragEnd: (id: string, x: number, y: number) => void;
  onNodeTransformEnd: (id: string, attrs: Partial<TextNodeConfig>) => void;
  stageRef?: React.RefObject<Konva.Stage | null>;
  onImageLoad?: () => void;
}

const SNAP_THRESHOLD = 5;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;

export function CoverCanvas({
  imageUrl,
  textNodes,
  selectedNodeId,
  onSelectNode,
  onNodeDragEnd,
  onNodeTransformEnd,
  stageRef: externalStageRef,
  onImageLoad,
}: CoverCanvasProps) {
  const internalStageRef = useRef<Konva.Stage>(null);
  const stageRef = externalStageRef || internalStageRef;
  const nodeRefs = useRef<Record<string, Konva.Text | null>>({});
  const transformerRef = useRef<Konva.Transformer>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const onImageLoadRef = useRef(onImageLoad);
  onImageLoadRef.current = onImageLoad;

  useEffect(() => {
    if (!imageUrl) {
      setBgImage(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      if (cancelled) return;
      setBgImage(img);
      onImageLoadRef.current?.();
    };
    return () => { cancelled = true; };
  }, [imageUrl]);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    const node = selectedNodeId ? nodeRefs.current[selectedNodeId] : null;
    if (node) {
      tr.nodes([node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedNodeId]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage()) {
        onSelectNode(null);
      }
    },
    [onSelectNode],
  );

  function handleDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target;
    const nodeCenterX = node.x() + node.width() / 2;
    const nodeCenterY = node.y() + node.height() / 2;
    const newGuides: Guide[] = [];

    if (Math.abs(nodeCenterX - CENTER_X) < SNAP_THRESHOLD) {
      node.x(CENTER_X - node.width() / 2);
      newGuides.push({ x: CENTER_X });
    }
    if (Math.abs(nodeCenterY - CENTER_Y) < SNAP_THRESHOLD) {
      node.y(CENTER_Y - node.height() / 2);
      newGuides.push({ y: CENTER_Y });
    }

    setGuides(newGuides);
  }

  function handleDragEnd(id: string, e: Konva.KonvaEventObject<DragEvent>) {
    setGuides([]);
    onNodeDragEnd(id, e.target.x(), e.target.y());
  }

  function handleTransformEnd(id: string) {
    const node = nodeRefs.current[id];
    if (!node) return;

    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);

    onNodeTransformEnd(id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(20, node.width() * scaleX),
      fontSize: Math.round(node.fontSize() * scaleX),
    });
  }

  function renderTextNode(config: TextNodeConfig) {
    if (!config.visible) return null;
    return (
      <Text
        key={config.id}
        ref={(ref) => {
          nodeRefs.current[config.id] = ref;
        }}
        id={config.id}
        text={config.text}
        x={config.x * SCALE}
        y={config.y * SCALE}
        fontSize={config.fontSize * SCALE}
        fontFamily={config.fontFamily}
        fill={config.fill}
        align={config.align}
        fontStyle={config.fontStyle}
        width={config.width * SCALE}
        draggable={config.draggable}
        shadowColor={config.shadowColor}
        shadowBlur={(config.shadowBlur ?? 0) * SCALE}
        shadowOffsetX={(config.shadowOffsetX ?? 2) * SCALE}
        shadowOffsetY={(config.shadowOffsetY ?? 2) * SCALE}
        shadowOpacity={config.shadowOpacity ?? 0.7}
        stroke={config.stroke || ""}
        strokeWidth={(config.strokeWidth ?? 0) * SCALE}
        onClick={() => onSelectNode(config.id)}
        onTap={() => onSelectNode(config.id)}
        onDragMove={handleDragMove}
        onDragEnd={(e) => handleDragEnd(config.id, e)}
        onTransformEnd={() => handleTransformEnd(config.id)}
      />
    );
  }

  return (
    <Stage
      ref={stageRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onClick={handleStageClick}
      onTap={handleStageClick}
      style={{ cursor: "default" }}
    >
      <Layer>
        {bgImage && (
          <KonvaImage
            image={bgImage}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
          />
        )}
      </Layer>
      <Layer>
        {textNodes.map(renderTextNode)}
        <Transformer
          ref={transformerRef}
          enabledAnchors={["middle-left", "middle-right"]}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 20) return oldBox;
            return newBox;
          }}
        />
      </Layer>
      {/* Snap guide layer */}
      <Layer listening={false}>
        {guides.map((g, i) =>
          g.x !== undefined ? (
            <Line
              key={`gx-${i}`}
              points={[g.x, 0, g.x, CANVAS_HEIGHT]}
              stroke="#00bfff"
              strokeWidth={1}
              dash={[4, 4]}
            />
          ) : g.y !== undefined ? (
            <Line
              key={`gy-${i}`}
              points={[0, g.y, CANVAS_WIDTH, g.y]}
              stroke="#00bfff"
              strokeWidth={1}
              dash={[4, 4]}
            />
          ) : null
        )}
      </Layer>
    </Stage>
  );
}

export function getDefaultCanvasState(
  title: string,
  author: string,
): CanvasState {
  return {
    textNodes: [
      {
        id: "title",
        name: "Title",
        text: title,
        x: 160,
        y: 200,
        fontSize: 96,
        fontFamily: "Playfair Display",
        fill: "#ffffff",
        align: "center",
        fontStyle: "bold",
        width: 1280,
        visible: true,
        draggable: true,
      },
      {
        id: "author",
        name: "Author",
        text: author,
        x: 160,
        y: 2200,
        fontSize: 56,
        fontFamily: "Montserrat",
        fill: "rgba(255,255,255,0.9)",
        align: "center",
        fontStyle: "normal",
        width: 1280,
        visible: true,
        draggable: true,
      },
    ],
  };
}
