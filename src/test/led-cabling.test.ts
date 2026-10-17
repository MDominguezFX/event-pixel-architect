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

import { scene3d } from "@/lib/led/scene3d";
describe("vista 3D", () => {
  const P = BUILTIN_PANELS.find((p) => p.widthMm === 500 && p.heightMm === 500)!;
  const lk = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);
  it("una pantalla plana queda en z = 0 y apoyada en el suelo", () => {
    const p = newProject(P); p.screens = [newScreen(P, "A", 4, 2)];
    const c = scene3d(p, lk);
    expect(c.length).toBe(8);
    expect(c.every((k) => k.z === 0)).toBe(true);
    expect(Math.min(...c.map((k) => k.y - k.h / 2))).toBeCloseTo(0);
  });
  it("un cilindro de 12 columnas cierra en un círculo", () => {
    const p = newProject(P); const s = newScreen(P, "C", 12, 1); s.geometry.type = "cilindro"; p.screens = [s];
    const c = scene3d(p, lk);
    const R = (12 * 0.5) / (2 * Math.PI);
    const cx = c.reduce((a, k) => a + k.x, 0) / 12, cz = c.reduce((a, k) => a + k.z, 0) / 12;
    for (const k of c) expect(Math.hypot(k.x - cx, k.z - cz)).toBeCloseTo(R, 2);
  });
});

describe("cableado manual", () => {
  const P = BUILTIN_PANELS.find((p) => p.widthMm === 500 && p.heightMm === 500)!;
  const lk = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);
  it("respeta los puertos dibujados por el usuario", () => {
    const s = newScreen(P, "M", 4, 2);
    const ids = s.cabinets.map((c) => c.id);
    s.manualRuns = [ids.slice(0, 3), ids.slice(3)];
    const r = cableRuns(s, lk);
    expect(r.manual).toBe(true);
    expect(r.runs.map((x) => x.cabinets.length)).toEqual([3, 5]);
    expect(r.errors).toEqual([]);
  });
  it("marca error si un puerto manual supera 650.000 px", () => {
    const big = BUILTIN_PANELS.find((p) => p.id === "r500-p26")!; // 192×192 = 36.864 px
    const s = newScreen(big, "X", 6, 3); // 18 gab = 663.552 px
    s.manualRuns = [s.cabinets.map((c) => c.id)];
    const r = cableRuns(s, lk);
    expect(r.errors.length).toBe(1);
  });
  it("avisa gabinetes sin asignar y saltos sin arista", () => {
    const s = newScreen(P, "S", 4, 1);
    s.manualRuns = [[s.cabinets[0]!.id, s.cabinets[2]!.id]]; // salta el del medio
    const r = cableRuns(s, lk);
    expect(r.warnings.some((w) => w.includes("sin cable asignado"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("sin arista"))).toBe(true);
  });
});

describe("montaje en techo", () => {
  const P = BUILTIN_PANELS.find((p) => p.widthMm === 500 && p.heightMm === 500)!;
  const lk = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);
  it("una pantalla de techo queda horizontal y elevada en el 3D", () => {
    const p = newProject(P); const s = newScreen(P, "T", 4, 2); s.mount = "techo"; p.screens = [s];
    const c = scene3d(p, lk);
    expect(c.every((k) => k.rotX === -Math.PI / 2)).toBe(true);
    expect(Math.min(...c.map((k) => k.y))).toBeGreaterThanOrEqual(1); // flota sobre el suelo
  });
});
