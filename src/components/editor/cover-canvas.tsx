"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 640;
const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 2560;
const SCALE = CANVAS_WIDTH / EXPORT_WIDTH;

export interface TextNodeConfig {
  id: string;
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
}

export interface CanvasState {
  titleNode: TextNodeConfig;
  authorNode: TextNodeConfig;
}

interface CoverCanvasProps {
  imageUrl: string | undefined;
  titleNode: TextNodeConfig;
  authorNode: TextNodeConfig;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onNodeDragEnd: (id: string, x: number, y: number) => void;
  onNodeTransformEnd: (id: string, attrs: Partial<TextNodeConfig>) => void;
}

export function CoverCanvas({
  imageUrl,
  titleNode,
  authorNode,
  selectedNodeId,
  onSelectNode,
  onNodeDragEnd,
  onNodeTransformEnd,
}: CoverCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const titleRef = useRef<Konva.Text>(null);
  const authorRef = useRef<Konva.Text>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setBgImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => setBgImage(img);
  }, [imageUrl]);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    let node: Konva.Text | null = null;
    if (selectedNodeId === "title") node = titleRef.current;
    if (selectedNodeId === "author") node = authorRef.current;

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

  function handleDragEnd(id: string, e: Konva.KonvaEventObject<DragEvent>) {
    onNodeDragEnd(id, e.target.x(), e.target.y());
  }

  function handleTransformEnd(id: string) {
    const node = id === "title" ? titleRef.current : authorRef.current;
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
        {titleNode.visible && (
          <Text
            ref={titleRef}
            id="title"
            text={titleNode.text}
            x={titleNode.x * SCALE}
            y={titleNode.y * SCALE}
            fontSize={titleNode.fontSize * SCALE}
            fontFamily={titleNode.fontFamily}
            fill={titleNode.fill}
            align={titleNode.align}
            fontStyle={titleNode.fontStyle}
            width={titleNode.width * SCALE}
            draggable={titleNode.draggable}
            onClick={() => onSelectNode("title")}
            onTap={() => onSelectNode("title")}
            onDragEnd={(e) => handleDragEnd("title", e)}
            onTransformEnd={() => handleTransformEnd("title")}
          />
        )}
        {authorNode.visible && (
          <Text
            ref={authorRef}
            id="author"
            text={authorNode.text}
            x={authorNode.x * SCALE}
            y={authorNode.y * SCALE}
            fontSize={authorNode.fontSize * SCALE}
            fontFamily={authorNode.fontFamily}
            fill={authorNode.fill}
            align={authorNode.align}
            fontStyle={authorNode.fontStyle}
            width={authorNode.width * SCALE}
            draggable={authorNode.draggable}
            onClick={() => onSelectNode("author")}
            onTap={() => onSelectNode("author")}
            onDragEnd={(e) => handleDragEnd("author", e)}
            onTransformEnd={() => handleTransformEnd("author")}
          />
        )}
        <Transformer
          ref={transformerRef}
          enabledAnchors={["middle-left", "middle-right"]}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 20) return oldBox;
            return newBox;
          }}
        />
      </Layer>
    </Stage>
  );
}

export function getDefaultCanvasState(
  title: string,
  author: string,
): CanvasState {
  return {
    titleNode: {
      id: "title",
      text: title,
      x: 160,
      y: 200,
      fontSize: 96,
      fontFamily: "Georgia, serif",
      fill: "#ffffff",
      align: "center",
      fontStyle: "bold",
      width: 1280,
      visible: true,
      draggable: true,
    },
    authorNode: {
      id: "author",
      text: author,
      x: 160,
      y: 2200,
      fontSize: 56,
      fontFamily: "Helvetica, sans-serif",
      fill: "rgba(255,255,255,0.9)",
      align: "center",
      fontStyle: "normal",
      width: 1280,
      visible: true,
      draggable: true,
    },
  };
}
