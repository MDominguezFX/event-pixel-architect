import { describe, expect, it } from "vitest";
import { BUILTIN_PANELS } from "@/lib/led/catalog";
import { newProject, newScreen } from "@/lib/led/model";
import { scene2d, sceneBounds, sceneDrag, sceneOffset } from "@/lib/led/scene2d";
import { scene3d } from "@/lib/led/scene3d";
import { cableNeighbors, cablePath, cableRuns } from "@/lib/led/cabling";
import { wiringPlan } from "@/lib/led/plan";

const panel = BUILTIN_PANELS.find((p) => p.id === "r500-p39");
if (!panel) throw new Error("Missing panel fixture");
const lookup = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);

describe("same cabinets in 2D and 3D", () => {
  it.each(["plana", "arco", "cilindro"] as const)("projects every cabinet of %s from the 3D boxes", (type) => {
    const p = newProject(panel), s = newScreen(panel, "Pantalla", 12, 2);
    s.geometry = { ...s.geometry, type, mode: "continua", input: "apertura", apertureDeg: 180 };
    p.screens = [s];
    const projected = scene2d(p, lookup, "espacial"), actual = scene3d(p, lookup);
    expect(projected.length).toBe(24);
    for (const c of actual) {
      const item = projected.find((v) => v.id === c.id);
      if (!item) throw new Error("Missing projected cabinet");
      const points = item.faces.flat();
      expect(points.reduce((sum, q) => sum + q.x, 0) / points.length).toBeCloseTo((Math.sqrt(3) / 2 * c.x - c.z / 2) * 1000);
      expect(points.reduce((sum, q) => sum + q.y, 0) / points.length).toBeCloseTo((-Math.sqrt(3) / 2 * c.y + c.x / 4 + Math.sqrt(3) / 4 * c.z) * 1000);
    }
    expect(sceneBounds(projected).w).toBeGreaterThan(0);
  });
  it("dragging inversely maps screen coordinates without jumping", () => {
    const move = sceneOffset(500, 200, "espacial");
    const original = sceneDrag(move.x, move.y, "espacial");
    expect(original.x).toBeCloseTo(500); expect(original.y).toBeCloseTo(200);
  });
});

describe("serpentine without diagonal connections", () => {
  it("splits diagonal-only cabinets into separate ports", () => {
    const s = newScreen(panel, "Diagonal", 2, 2);
    s.cabinets = s.cabinets.filter((c) => c.x === c.y);
    expect(cableRuns(s, lookup).runs.map((r) => r.cabinets.length)).toEqual([1, 1]);
  });
  it("routes mixed offset panels using only horizontal and vertical segments", () => {
    const large = lookup("r1000-p39");
    if (!large) throw new Error("Missing large fixture");
    const s = newScreen(panel, "Mixta", 1, 1);
    s.cabinets = [{ id: "a", panelId: large.id, x: 0, y: 0, rotated: false }, { id: "b", panelId: panel.id, x: 500, y: 500, rotated: false }];
    const [a, b] = s.cabinets;
    if (!a || !b) throw new Error("Missing cabinets");
    expect(cableNeighbors(a, b, lookup)).toBe(true);
    const path = cablePath(a, b, lookup);
    expect(path).toHaveLength(4);
    path.slice(1).forEach((point, i) => { const previous = path[i]; expect(previous && (previous.x === point.x || previous.y === point.y)).toBe(true); });
    const lines = wiringPlan(s, lookup, { dims: false, numbers: true, ink: "ink", muted: "muted" }).prims.filter((p) => p.t === "line");
    expect(lines.length).toBe(3);
    for (const line of lines) expect(line.x1 === line.x2 || line.y1 === line.y2).toBe(true);
  });
});