import { describe, expect, it } from "vitest";
import { BUILTIN_PANELS } from "@/lib/led/catalog";
import { cableRuns } from "@/lib/led/cabling";
import { newScreen } from "@/lib/led/model";

const lookup = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);
const panel = lookup("r1000-p39");
if (!panel) throw new Error("Missing fixture");
describe("650.000 píxeles por cable", () => {
  it("8×3 P3.9 agrupa 19 y 5 gabinetes sin superar 650.000", () => {
    const screen = newScreen(panel, "Principal", 8, 3);
    const result = cableRuns(screen, lookup);
    expect(result.errors).toEqual([]);
    expect(result.runs.map((r) => r.pixels)).toEqual([622592, 163840]);
    expect(result.runs.map((r) => r.cabinets.length)).toEqual([19, 5]);
    expect(new Set(result.runs.flatMap((r) => r.cabinets.map((c) => c.id))).size).toBe(24);
  });
  it("acepta exactamente 650.000, pero no añade un segundo gabinete", () => {
    const exact = { ...panel, resX: 1000, resY: 650 };
    const result = cableRuns(newScreen(exact, "Exacto", 2, 1), () => exact);
    expect(result.runs.map((r) => r.pixels)).toEqual([650000, 650000]);
  });
  it("bloquea un gabinete mayor de 650.000 sin inventar una división", () => {
    const large = { ...panel, resX: 1000, resY: 651 };
    const result = cableRuns(newScreen(large), () => large);
    expect(result.runs).toEqual([]);
    expect(result.errors.length).toBe(32);
  });
  it("la rotación conserva carga y todos los gabinetes", () => {
    const screen = newScreen(panel, "Rotada", 8, 3);
    screen.cabinets.forEach((c) => { c.rotated = true; });
    expect(cableRuns(screen, lookup).runs.reduce((sum, r) => sum + r.pixels, 0)).toBe(786432);
  });
});
import { outputQuad, rotateSlice, rotateSlices } from "@/lib/led/mapping";
import { rotateFree } from "@/lib/led/edit";
import { generateArenaXml } from "@/lib/led/resolume";
import { newProject } from "@/lib/led/model";
import { portColor } from "@/lib/led/plan";

describe("slices, Arena y puertos", () => {
  it("girar un slice 90° lo rota sobre su centro", () => {
    const s = rotateSlice({ id: "a", name: "A", input: { x: 0, y: 0, w: 200, h: 100 }, output: { x: 0, y: 0, w: 200, h: 100 }, outputIndex: 0 });
    expect(s.rotation).toBe(90);
    expect(outputQuad(s)[0]).toEqual({ x: 150, y: -50 });
  });
  it("giros parciales de 5° se acumulan y vuelven a 0 en 360°", () => {
    let s: import("@/lib/led/model").Slice = { id: "a", name: "A", input: { x: 0, y: 0, w: 10, h: 10 }, output: { x: 0, y: 0, w: 10, h: 10 }, outputIndex: 0 };
    s = rotateSlice(s, 5); s = rotateSlice(s, 5);
    expect(s.rotation).toBe(10);
    expect(rotateSlice(s, 350).rotation).toBe(0);
  });
  it("un grupo de slices gira alrededor de su centro común", () => {
    const mk = (id: string, x: number) => ({ id, name: id, input: { x, y: 0, w: 100, h: 100 }, output: { x, y: 0, w: 100, h: 100 }, outputIndex: 0 });
    const r = rotateSlices([mk("a", 0), mk("b", 100)], new Set(["a", "b"]), 180);
    expect(r.map((s) => s.output.x)).toEqual([100, 0]);
  });
  it("giro libre de gabinetes no cambia la cantidad y acumula el ángulo", () => {
    const P = BUILTIN_PANELS[0]!;
    const r = rotateFree([{ id: "a", panelId: P.id, x: 0, y: 0, rotated: false }], new Set(["a"]), 5, (id) => BUILTIN_PANELS.find((p) => p.id === id));
    expect(r[0]).toMatchObject({ angleDeg: 5, x: 0, y: 0 });
  });
  it("genera XML de Arena sin plantilla con un slice por slice del proyecto", () => {
    const p = newProject(BUILTIN_PANELS[6]!);
    p.mapping.slices = [{ id: "a", name: "Pantalla <1>", input: { x: 0, y: 0, w: 1024, h: 768 }, output: { x: 0, y: 0, w: 1024, h: 768 }, outputIndex: 0 }];
    const xml = generateArenaXml(p);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.getElementsByTagName("parsererror").length).toBe(0);
    expect(doc.getElementsByTagName("Slice").length).toBe(1);
    expect(xml).toContain("Pantalla &lt;1&gt;");
  });
  it("cada puerto tiene un color distinto", () => {
    expect(new Set([1, 2, 3, 4, 5].map(portColor)).size).toBe(5);
  });
});

import { rotateGroup } from "@/lib/led/edit";
describe("girar paneles", () => {
  const P = BUILTIN_PANELS.find((p) => p.widthMm === 500 && p.heightMm === 1000)!;
  const lk = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);
  it("un panel solo gira en su lugar", () => {
    const r = rotateGroup([{ id: "a", panelId: P.id, x: 0, y: 0, rotated: false }], new Set(["a"]), lk)!;
    expect(r[0]).toMatchObject({ rotated: true, x: 0, y: 0 });
  });
  it("un grupo 2×1 gira como bloque a 1×2", () => {
    const cabs = [{ id: "a", panelId: P.id, x: 0, y: 0, rotated: false }, { id: "b", panelId: P.id, x: 500, y: 0, rotated: false }];
    const r = rotateGroup(cabs, new Set(["a", "b"]), lk)!;
    expect(r.map((c) => [c.x, c.y, c.rotated])).toEqual([[0, 0, true], [0, 500, true]]);
  });
  it("bloquea si se superpone", () => {
    const cabs = [{ id: "a", panelId: P.id, x: 0, y: 0, rotated: false }, { id: "b", panelId: P.id, x: 500, y: 0, rotated: false }];
    expect(rotateGroup(cabs, new Set(["a"]), lk)).toBeNull();
  });
});
