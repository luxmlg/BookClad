import { KDP } from "@/lib/constants";
import { DEFAULT_FONT } from "@/lib/fonts";

const CANVAS_SCALE_DIVISOR = 4;
export const CANVAS_WIDTH = KDP.width / CANVAS_SCALE_DIVISOR;   // 400
export const CANVAS_HEIGHT = KDP.height / CANVAS_SCALE_DIVISOR; // 640
export const SCALE = 1 / CANVAS_SCALE_DIVISOR;

// ── Node Types ──────────────────────────────────────────

export const NODE_TYPE = {
  TEXT: "text",
  IMAGE: "image",
} as const;
export type NodeType = typeof NODE_TYPE[keyof typeof NODE_TYPE];

export interface TextNodeConfig {
  type: typeof NODE_TYPE.TEXT;
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
  rotation?: number;
  autoWidth?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: string;
  textTransform?: "none" | "uppercase" | "lowercase";
}

export interface ImageNodeConfig {
  type: typeof NODE_TYPE.IMAGE;
  id: string;
  name?: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  visible: boolean;
  draggable: boolean;
  opacity?: number;
}

export type CanvasNode = TextNodeConfig | ImageNodeConfig;

export interface CanvasState {
  nodes: CanvasNode[];
}

export function parseCanvasState(raw: unknown): CanvasState | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.nodes)) return { nodes: obj.nodes as CanvasNode[] };
  return null;
}

export function getDefaultCanvasState(
  title: string,
  author: string,
): CanvasState {
  return {
    nodes: [
      {
        type: NODE_TYPE.TEXT,
        id: "title",
        name: "Title",
        text: title,
        x: 800,
        y: 200,
        fontSize: 96,
        fontFamily: DEFAULT_FONT,
        fill: "#ffffff",
        align: "center",
        fontStyle: "bold",
        width: 1280,
        visible: true,
        draggable: true,
        autoWidth: true,
      },
      {
        type: NODE_TYPE.TEXT,
        id: "author",
        name: "Author",
        text: author,
        x: 800,
        y: 2200,
        fontSize: 56,
        fontFamily: "Montserrat",
        fill: "rgba(255,255,255,0.9)",
        align: "center",
        fontStyle: "normal",
        width: 1280,
        visible: true,
        draggable: true,
        autoWidth: true,
      },
    ],
  };
}
