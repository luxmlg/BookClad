import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/components/editor/canvas-types";

export interface Guide {
  x?: number;
  y?: number;
  type?: "grid" | "element";
}

export const SNAP_THRESHOLD = 5;

export const GRID_LINES_X = [0, 0.25, 0.5, 0.75, 1].map((p) => p * CANVAS_WIDTH);
export const GRID_LINES_Y = [0, 0.25, 0.5, 0.75, 1].map((p) => p * CANVAS_HEIGHT);

interface SnapTarget {
  pos: number;
  type: "grid" | "element";
}

interface NodeEdges {
  left: number;
  right: number;
  centerX: number;
  top: number;
  bottom: number;
  centerY: number;
}

export interface SnapResult {
  guides: Guide[];
  dx: number | null;
  dy: number | null;
}

function findBestSnap(
  targets: SnapTarget[],
  edges: number[],
): { delta: number; snapPos: number; type: "grid" | "element" } | null {
  let bestDelta: number | null = null;
  let bestSnapPos: number | null = null;
  let bestAbsDelta = SNAP_THRESHOLD;
  let bestType: "grid" | "element" = "grid";

  for (const target of targets) {
    for (const edge of edges) {
      const delta = target.pos - edge;
      if (Math.abs(delta) < bestAbsDelta) {
        bestAbsDelta = Math.abs(delta);
        bestDelta = delta;
        bestSnapPos = target.pos;
        bestType = target.type;
      }
    }
  }

  if (bestDelta !== null && bestSnapPos !== null) {
    return { delta: bestDelta, snapPos: bestSnapPos, type: bestType };
  }
  return null;
}

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function computeSnapGuides(
  draggedNode: NodeEdges,
  otherElements: ElementRect[],
): SnapResult {
  const guides: Guide[] = [];

  const xTargets: SnapTarget[] = GRID_LINES_X.map((pos) => ({ pos, type: "grid" }));
  const yTargets: SnapTarget[] = GRID_LINES_Y.map((pos) => ({ pos, type: "grid" }));

  for (const el of otherElements) {
    const left = el.x - el.offsetX;
    xTargets.push(
      { pos: left, type: "element" },
      { pos: left + el.width / 2, type: "element" },
      { pos: left + el.width, type: "element" },
    );
    const top = el.y - el.offsetY;
    yTargets.push(
      { pos: top, type: "element" },
      { pos: top + el.height / 2, type: "element" },
      { pos: top + el.height, type: "element" },
    );
  }

  const xSnap = findBestSnap(
    xTargets,
    [draggedNode.left, draggedNode.centerX, draggedNode.right],
  );
  const ySnap = findBestSnap(
    yTargets,
    [draggedNode.top, draggedNode.centerY, draggedNode.bottom],
  );

  if (xSnap) guides.push({ x: xSnap.snapPos, type: xSnap.type });
  if (ySnap) guides.push({ y: ySnap.snapPos, type: ySnap.type });

  return {
    guides,
    dx: xSnap?.delta ?? null,
    dy: ySnap?.delta ?? null,
  };
}
