import { describe, expect, it } from "vitest";
import { BUILTIN_PANELS } from "@/lib/led/catalog";
import { screenStats } from "@/lib/led/engine";
import { computeCurve } from "@/lib/led/geometry";
import { buildMix, mixCompat, mixOptions, splitLarge, mergeSmall } from "@/lib/led/mix";
import { defaultGeometry, newProject, newScreen } from "@/lib/led/model";
import { slicesByCabinet } from "@/lib/led/mapping";
import { validateProject } from "@/lib/led/persistence";

const look = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);
const S = look("r500-p39")!, L = look("r1000-p39")!;

describe("motor plano", () => {
  it("8×3 P3.9 500×1000", () => {
    const s = newScreen(L, "x", 8, 3);
    const st = screenStats(s, look);
    expect(st.widthMm).toBe(4000); expect(st.heightMm).toBe(3000);
    expect(st.count).toBe(24); expect(st.areaM2).toBeCloseTo(12);
    expect([st.resX, st.resY]).toEqual([1024, 768]); expect(st.activePixels).toBe(786432);
  });
});

describe("mezcla", () => {
  const inp = { small: S, large: L, wantWmm: 4000, wantHmm: 2500, goal: "menos" as const };
  it("requiere confirmación de familia", () => {
    expect(mixCompat(S, L, false).ok).toBe(false);
    expect(mixCompat(S, L, true).ok).toBe(true);
  });
  it("4×2,5 m → 16 + 8", () => {
    const o = mixOptions(inp).find((x) => x.name === "Mezcla")!;
    expect([o.large, o.small, o.total, o.cols, o.bands]).toEqual([16, 8, 24, 8, 2]);
    for (const band of ["arriba", "abajo"] as const) {
      const s = newScreen(S); s.cabinets = buildMix(inp, o, band);
      const st = screenStats(s, look);
      expect(st.areaM2).toBeCloseTo(10); expect(st.count).toBe(24);
      expect([st.resX, st.resY]).toEqual([1024, 640]); expect(st.covered).toBe(true); expect(st.overlaps).toBe(false);
    }
  });
  it("respeta stock", () => {
    const o = mixOptions({ ...inp, stockLarge: 10, stockSmall: 100 }).find((x) => x.name === "Mezcla")!;
    expect(o.feasible).toBe(false); expect(o.shortage.large).toBe(6);
  });
  it("dividir y unir conserva resolución", () => {
    const o = mixOptions(inp).find((x) => x.name === "Mezcla")!;
    const s = newScreen(S); s.cabinets = buildMix(inp, o, "abajo");
    const big = s.cabinets.find((c) => c.panelId === L.id)!;
    s.cabinets = splitLarge(s.cabinets, big.id, S);
    let st = screenStats(s, look); expect([st.resX, st.resY, st.count, st.covered]).toEqual([1024, 640, 25, true]);
    s.cabinets = mergeSmall(s.cabinets, s.cabinets.at(-1)!.id, S, L);
    st = screenStats(s, look); expect([st.count, st.covered]).toEqual([24, true]);
  });
});

describe("curvas", () => {
  it("cilindro continuo: R = L/2π", () => {
    const g = { ...defaultGeometry(), type: "cilindro" as const, mode: "continua" as const };
    const r = computeCurve(g, 20, 500);
    expect(r.radiusMm).toBeCloseTo(10000 / (2 * Math.PI)); expect(r.apertureDeg).toBeCloseTo(360);
  });
  it("cilindro facetado cierra y giro = 360/N", () => {
    const g = { ...defaultGeometry(), type: "cilindro" as const };
    const r = computeCurve(g, 12, 500);
    expect(r.closes).toBe(true); expect(r.turnDeg).toBeCloseTo(30);
    expect(r.radiusVertexMm! > r.radiusMm!).toBe(true);
  });
  it("ángulo fuera de especificación da error", () => {
    const g = { ...defaultGeometry(), type: "cilindro" as const };
    const r = computeCurve(g, 12, 500, { ...S, curvable: true, angleMaxDeg: 10 });
    expect(r.valid).toBe(false);
  });
  it("curvar no altera superficie ni píxeles", () => {
    const s = newScreen(S, "c", 10, 4); const a = screenStats(s, look);
    s.geometry = { ...s.geometry, type: "concava", angleDeg: 5 };
    const b = screenStats(s, look);
    expect([b.areaM2, b.resX, b.resY]).toEqual([a.areaM2, a.resX, a.resY]);
  });
  it("continua: cuerda < desarrollo", () => {
    const g = { ...defaultGeometry(), type: "arco" as const, mode: "continua" as const, input: "radio" as const, radiusMm: 3000 };
    const r = computeCurve(g, 10, 500);
    expect(r.chordMm).toBeLessThan(5000); expect(r.apertureDeg).toBeCloseTo((5000 / 3000) * 180 / Math.PI);
  });
});

describe("coordenadas y JSON", () => {
  it("slices por gabinete: vertical tiene doble altura", () => {
    const p = newProject(S);
    const o = mixOptions({ small: S, large: L, wantWmm: 4000, wantHmm: 2500, goal: "menos" }).find((x) => x.name === "Mezcla")!;
    p.screens[0]!.cabinets = buildMix({ small: S, large: L, wantWmm: 4000, wantHmm: 2500, goal: "menos" }, o, "arriba");
    const sl = slicesByCabinet(p, look);
    expect(sl.find((x) => x.input.h === 256)).toBeTruthy(); expect(sl.find((x) => x.input.h === 128)).toBeTruthy();
    expect(Math.max(...sl.map((x) => x.input.y + x.input.h))).toBe(640);
  });
  it("JSON ida y vuelta", () => {
    const p = newProject(S);
    const back = validateProject(JSON.parse(JSON.stringify(p)));
    expect(back.project).toEqual(p);
    expect(validateProject({ foo: 1 }).errors.length).toBeGreaterThan(0);
  });
});
