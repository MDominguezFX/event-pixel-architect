import type { PanelLookup } from "./engine";
import { cabDims } from "./engine";
import type { Project } from "./model";
import { scene3d } from "./scene3d";

export type SceneView = "espacial" | "frontal" | "desarrollada";
export interface ScenePoint { x: number; y: number }
export interface Panel2D { id: string; screenId: string; faces: ScenePoint[][]; depth: number }

// Orthographic projection of the very same cabinet boxes used by Scene3D.
const COS = Math.sqrt(3) / 2;
function project(x: number, y: number, z: number, view: SceneView): ScenePoint {
  return view === "espacial" ? { x: COS * x - z / 2, y: -COS * y + x / 4 + COS * z / 2 } : { x, y: -y };
}

export function sceneDrag(dx: number, dy: number, view: SceneView): ScenePoint {
  if (view !== "espacial") return { x: dx, y: dy };
  const x = dx / COS;
  return { x, y: (dy - x / 4) / COS };
}

export function sceneOffset(dx: number, dy: number, view: SceneView): ScenePoint {
  return project(dx, -dy, 0, view);
}

export function scene2d(p: Project, lookup: PanelLookup, view: SceneView): Panel2D[] {
  if (view === "desarrollada") return p.screens.flatMap((s) => s.cabinets.flatMap((c) => {
    const panel = lookup(c.panelId);
    if (!panel) return [];
    const d = cabDims(c, panel), angle = (c.angleDeg ?? 0) * Math.PI / 180;
    const cx = s.x + c.x + d.w / 2, cy = s.y + c.y + d.h / 2;
    const points = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([x, y]) => ({
      x: cx + x * d.w / 2 * Math.cos(angle) - y * d.h / 2 * Math.sin(angle),
      y: cy + x * d.w / 2 * Math.sin(angle) + y * d.h / 2 * Math.cos(angle),
    }));
    return [{ id: c.id, screenId: s.id, faces: [points], depth: 0 }];
  }));
  return scene3d(p, lookup).map((c) => {
    const vertices = ([[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]] as const).map(([a,b,d]) => {
      const x = a * c.w * 0.985 / 2, y = b * c.h * 0.985 / 2, z = d * 0.08 / 2;
      const rx = x * Math.cos(c.tilt) + y * Math.sin(c.tilt);
      const ry = -x * Math.sin(c.tilt) + y * Math.cos(c.tilt);
      return project((c.x + rx * Math.cos(c.rotY) + z * Math.sin(c.rotY)) * 1000,
        (c.y + ry) * 1000, (c.z - rx * Math.sin(c.rotY) + z * Math.cos(c.rotY)) * 1000, view);
    });
    const faces = [[0,1,2,3],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0],[4,7,6,5]].map((ids) => ids.flatMap((i) => {
      const point = vertices[i]; return point ? [point] : [];
    }));
    return { id: c.id, screenId: c.screenId, faces, depth: c.x / 2 + c.z * COS };
  }).sort((a, b) => a.depth - b.depth);
}

export function sceneBounds(panels: Panel2D[]) {
  const points = panels.flatMap((c) => c.faces.flat());
  if (!points.length) return { x: 0, y: 0, w: 1000, h: 1000 };
  const x = Math.min(...points.map((p) => p.x)), y = Math.min(...points.map((p) => p.y));
  return { x, y, w: Math.max(...points.map((p) => p.x)) - x, h: Math.max(...points.map((p) => p.y)) - y };
}