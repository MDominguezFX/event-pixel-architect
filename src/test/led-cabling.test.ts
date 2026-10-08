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
import { outputQuad, rotateSlice } from "@/lib/led/mapping";
import { generateArenaXml } from "@/lib/led/resolume";
import { newProject } from "@/lib/led/model";
import { portColor } from "@/lib/led/plan";

describe("slices, Arena y puertos", () => {
  it("girar 90° intercambia la caja de salida y rota las esquinas", () => {
    const s = rotateSlice({ id: "a", name: "A", input: { x: 0, y: 0, w: 200, h: 100 }, output: { x: 0, y: 0, w: 200, h: 100 }, outputIndex: 0 });
    expect(s.rotation).toBe(90);
    expect(s.output).toEqual({ x: 0, y: 0, w: 100, h: 200 });
    expect(outputQuad(s)[0]).toEqual({ x: 100, y: 0 });
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
