import { describe, expect, it } from "vitest";
import { BUILTIN_PANELS } from "@/lib/led/catalog";
import { newProject, newScreen } from "@/lib/led/model";
import { scene2d, sceneBounds, sceneDrag, sceneOffset, moveSceneScreen } from "@/lib/led/scene2d";
import { scene3d } from "@/lib/led/scene3d";
import { cableNeighbors, cablePath, cableRuns } from "@/lib/led/cabling";
import { wiringPlan } from "@/lib/led/plan";

const panel = BUILTIN_PANELS.find((p) => p.id === "r500-p39");
if (!panel) throw new Error("Missing panel fixture");
const lookup = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);

describe("same cabinets in 2D and 3D", () => {
  it.each([0, 45, 90, -90])("lateral view projects depth and height at %s° and drags only the selected screen", (angle) => {
    const p = newProject(panel);
    const s = newScreen(panel, "Lateral", 4, 2);
    s.x = 1234; s.z = 800; s.mountHeightM = 4.35; s.mountTiltDeg = angle; s.mountYawDeg = 30;
    p.screens.push(s);
    const before = scene2d(p, lookup, "lateral");
    for (const box of scene3d(p, lookup)) {
      const item = before.find((v) => v.id === box.id);
      if (!item) throw new Error("Missing lateral cabinet");
      const points = item.faces.flat();
      expect(points.reduce((sum, q) => sum + q.x, 0) / points.length).toBeCloseTo(box.z * 1000);
      expect(points.reduce((sum, q) => sum + q.y, 0) / points.length).toBeCloseTo(-box.y * 1000);
    }
    const moved = moveSceneScreen(s, 300, -200, "lateral", "suelo", lookup);
    expect(moved.x).toBe(1234);
    expect(moved.z).toBe(1100);
    expect(moved.mountHeightM).toBeCloseTo(4.55);
    expect(moved.cabinets).toEqual(s.cabinets);
    p.screens[1] = moved;
    const after = scene2d(p, lookup, "lateral");
    for (const item of before) {
      const next = after.find((c) => c.id === item.id);
      if (!next) throw new Error("Missing moved lateral cabinet");
      item.faces.forEach((face, i) => face.forEach((q, j) => {
        expect((next.faces[i]?.[j]?.x ?? NaN) - q.x).toBeCloseTo(item.screenId === s.id ? 300 : 0);
        expect((next.faces[i]?.[j]?.y ?? NaN) - q.y).toBeCloseTo(item.screenId === s.id ? -200 : 0);
      }));
    }
  });
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
  it.each([0, 45, 90])("moves the whole screen at %s° by the exact projected drag without moving other screens", (angle) => {
    const p = newProject(panel);
    const s = newScreen(panel, "Movible", 4, 2);
    s.mountTiltDeg = angle; s.mountHeightM = 4.35;
    p.screens.push(s);
    const before = scene2d(p, lookup, "espacial");
    p.screens[1] = moveSceneScreen(s, 300, -200, "espacial", "vertical", lookup);
    const after = scene2d(p, lookup, "espacial");
    for (const item of before) {
      const next = after.find((c) => c.id === item.id);
      if (!next) throw new Error("Missing cabinet");
      item.faces.forEach((face, i) => face.forEach((q, j) => {
        const actual = next.faces[i]?.[j];
        expect((actual?.x ?? NaN) - q.x).toBeCloseTo(item.screenId === s.id ? 300 : 0);
        expect((actual?.y ?? NaN) - q.y).toBeCloseTo(item.screenId === s.id ? -200 : 0);
      }));
    }
  });
  it("moves ceiling screens in depth without changing their chosen height or native layout", () => {
    const s = newScreen(panel, "Techo", 4, 2); s.mount = "techo"; s.mountHeightM = 4.35;
    const moved = moveSceneScreen(s, 300, 200, "espacial", "suelo", lookup);
    expect(moved.mountHeightM).toBe(4.35);
    expect(moved.z).toBeCloseTo(-150 + Math.sqrt(3) * 200);
    expect(moved.cabinets).toEqual(s.cabinets);
    const p = newProject(panel); p.screens = [s];
    const before = scene2d(p, lookup, "espacial"); p.screens = [moved];
    const after = scene2d(p, lookup, "espacial");
    expect((after[0]?.faces[0]?.[0]?.x ?? NaN) - (before[0]?.faces[0]?.[0]?.x ?? NaN)).toBeCloseTo(300);
    expect((after[0]?.faces[0]?.[0]?.y ?? NaN) - (before[0]?.faces[0]?.[0]?.y ?? NaN)).toBeCloseTo(200);
    expect(scene3d(p, lookup).every((c) => Math.abs(c.y - 4.35) < 1e-6)).toBe(true);
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
import { rotateFree } from "@/lib/led/edit";
import { layoutPlan } from "@/lib/led/plan";
describe("horizontal cabling that turns with the screen", () => {
  const opts = { dims: true, numbers: true, ink: "ink", muted: "muted" };
  const big = lookup("r1000-p39")!;
  const lines = (s: ReturnType<typeof newScreen>) => wiringPlan(s, lookup, opts).prims.filter((p) => p.t === "line" && p.stroke === "#ffffff") as { x1: number; y1: number; x2: number; y2: number }[];
  it("routes along rows: each row of 8 is one horizontal line of 7 links", () => {
    const s = newScreen(big, "A", 8, 3);
    const ls = lines(s);
    expect(ls.filter((l) => Math.abs(l.y1 - l.y2) < 1e-6).length).toBeGreaterThanOrEqual(7 * 2);
  });
  it("a screen rotated 30° keeps the same ports and every cable segment follows 30° or 120°", () => {
    const s = newScreen(big, "A", 8, 3);
    const base = cableRuns(s, lookup).runs.map((r) => r.cabinets.length);
    const r = { ...s, cabinets: rotateFree(s.cabinets, new Set(s.cabinets.map((c) => c.id)), 30, lookup) };
    expect(cableRuns(r, lookup).runs.map((x) => x.cabinets.length)).toEqual(base);
    for (const l of lines(r)) {
      const a = ((Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180) / Math.PI + 360) % 90;
      expect(Math.min(Math.abs(a - 30), Math.abs(a - 30 + 90), Math.abs(a - 30 - 90))).toBeLessThan(0.5);
    }
  });
  it("front plan dimension texts turn with a rotated screen", () => {
    const s = newScreen(big, "A", 8, 3);
    const r = { ...s, cabinets: rotateFree(s.cabinets, new Set(s.cabinets.map((c) => c.id)), 30, lookup) };
    const t = frontPlanTexts(r).find((p) => p.s.includes("1024 px"));
    expect(t?.rot).toBe(30);
  });
  it("layout plan states how many screens and cabinets", () => {
    const p = newProject(big); p.screens = [newScreen(big, "A", 8, 3), newScreen(big, "B", 2, 1)];
    const texts = layoutPlan(p, lookup, opts).prims.flatMap((x) => (x.t === "text" ? [x.s] : []));
    expect(texts).toContain("2 pantallas · 26 gabinetes en total");
  });
});
import { frontPlan } from "@/lib/led/plan";
function frontPlanTexts(s: ReturnType<typeof newScreen>) {
  return frontPlan(s, lookup, { dims: true, numbers: true, ink: "ink", muted: "muted" }).prims.flatMap((p) => (p.t === "text" ? [p] : []));
}
