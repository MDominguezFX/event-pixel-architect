// Motor de cálculo: todo se calcula desde la distribución real de gabinetes.
import { realPitch, type Panel } from "./catalog";
import type { Cabinet, Corner, NumberOrder, Screen } from "./model";

export type PanelLookup = (id: string) => Panel | undefined;

export function cabDims(c: Cabinet, p: Panel) {
  return c.rotated
    ? { w: p.heightMm, h: p.widthMm, rx: p.resY, ry: p.resX }
    : { w: p.widthMm, h: p.heightMm, rx: p.resX, ry: p.resY };
}

export interface TypeCount {
  panel: Panel;
  rotated: boolean;
  count: number;
  weightKg: number | null;
  powerMaxW: number | null;
  powerAvgW: number | null;
  cases: number | null;
}

export interface ScreenStats {
  widthMm: number; // envolvente desarrollada
  heightMm: number;
  areaM2: number; // superficie LED instalada (suma real)
  envelopeM2: number;
  resX: number; // tamaño de canvas desarrollado en píxeles
  resY: number;
  activePixels: number; // píxeles activos reales (suma por gabinete)
  count: number;
  types: TypeCount[];
  aspect: number;
  aspectLabel: string;
  diff169Pct: number;
  weightKg: number | null;
  powerMaxW: number | null;
  powerAvgW: number | null;
  covered: boolean; // la envolvente está cubierta sin huecos
  overlaps: boolean;
  mixedPitch: boolean;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

export function aspectLabel(w: number, h: number) {
  if (!w || !h) return "-";
  const g = gcd(Math.round(w), Math.round(h));
  const a = Math.round(w) / g, b = Math.round(h) / g;
  return a <= 64 && b <= 64 ? `${a}:${b}` : `${(w / h).toFixed(3)}:1`;
}

export function screenStats(s: Screen, lookup: PanelLookup): ScreenStats {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let area = 0, active = 0;
  const map = new Map<string, TypeCount>();
  const pitches = new Set<string>();
  // Mapa de píxeles por fila/columna para el canvas desarrollado
  for (const c of s.cabinets) {
    const p = lookup(c.panelId);
    if (!p) continue;
    const d = cabDims(c, p);
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + d.w); maxY = Math.max(maxY, c.y + d.h);
    area += (d.w * d.h) / 1e6;
    active += d.rx * d.ry;
    pitches.add(realPitch(p).x.toFixed(4));
    const key = p.id + (c.rotated ? "@r" : "");
    const t = map.get(key) ?? { panel: p, rotated: c.rotated, count: 0, weightKg: 0, powerMaxW: 0, powerAvgW: 0, cases: 0 };
    t.count++;
    map.set(key, t);
  }
  const types = [...map.values()].map((t) => ({
    ...t,
    weightKg: t.panel.weightKg != null ? t.panel.weightKg * t.count : null,
    powerMaxW: t.panel.powerMaxW != null ? t.panel.powerMaxW * t.count : null,
    powerAvgW: t.panel.powerAvgW != null ? t.panel.powerAvgW * t.count : null,
    cases: t.panel.perCase ? Math.ceil(t.count / t.panel.perCase) : null,
  }));
  const sumOrNull = (k: "weightKg" | "powerMaxW" | "powerAvgW") =>
    types.length && types.every((t) => t[k] != null) ? types.reduce((a, t) => a + (t[k] as number), 0) : null;
  if (!isFinite(minX)) { minX = minY = maxX = maxY = 0; }
  const W = maxX - minX, H = maxY - minY;
  // Resolución del canvas desarrollado: se calcula por columnas y filas reales
  const resX = canvasExtent(s, lookup, "x", minX);
  const resY = canvasExtent(s, lookup, "y", minY);
  const aspect = resY ? resX / resY : 0;
  const ov = hasOverlaps(s, lookup);
  return {
    widthMm: W, heightMm: H, areaM2: area, envelopeM2: (W * H) / 1e6,
    resX, resY, activePixels: active, count: s.cabinets.length, types,
    aspect, aspectLabel: aspectLabel(resX, resY), diff169Pct: aspect ? ((aspect - 16 / 9) / (16 / 9)) * 100 : 0,
    weightKg: sumOrNull("weightKg"), powerMaxW: sumOrNull("powerMaxW"), powerAvgW: sumOrNull("powerAvgW"),
    covered: !ov && Math.abs(area - (W * H) / 1e6) < 1e-6, overlaps: ov, mixedPitch: pitches.size > 1,
  };
}

/** Extensión en píxeles: máxima suma de píxeles en cualquier línea (fila o columna) del layout. */
function canvasExtent(s: Screen, lookup: PanelLookup, axis: "x" | "y", origin: number) {
  let max = 0;
  for (const c of s.cabinets) {
    const p = lookup(c.panelId); if (!p) continue;
    const px = pixelOrigin(s, lookup, c, axis, origin) + (axis === "x" ? cabDims(c, p).rx : cabDims(c, p).ry);
    max = Math.max(max, px);
  }
  return max;
}

/** Coordenada en píxeles del gabinete en el canvas desarrollado (suma de gabinetes previos en su línea). */
export function pixelOrigin(s: Screen, lookup: PanelLookup, c: Cabinet, axis: "x" | "y", origin = 0): number {
  const p = lookup(c.panelId)!;
  const pitch = axis === "x" ? realPitch(p).x : realPitch(p).y;
  // Para pitch uniforme, píxel = mm / pitch (exacto con enteros nativos).
  return Math.round(((axis === "x" ? c.x : c.y) - origin) / pitch);
}

function hasOverlaps(s: Screen, lookup: PanelLookup) {
  const rs = s.cabinets.map((c) => { const p = lookup(c.panelId); const d = p ? cabDims(c, p) : { w: 0, h: 0 }; return { x: c.x, y: c.y, w: d.w, h: d.h }; });
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i]!, b = rs[j]!;
      if (a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01) return true;
    }
  return false;
}

/** Numeración por filas, columnas o serpentina con esquina inicial configurable. */
export function numberCabinets(s: Screen, lookup: PanelLookup): Map<string, number> {
  const { order, start } = s.numbering;
  const items = s.cabinets.map((c) => {
    const d = cabDims(c, lookup(c.panelId)!);
    return { id: c.id, cx: c.x + d.w / 2, cy: c.y + d.h / 2 };
  });
  const flipX = start === "tr" || start === "br";
  const flipY = start === "bl" || start === "br";
  const key = (v: number) => Math.round(v);
  const primary = order === "columnas" || order === "serpentina" ? "cx" : "cy";
  const secondary = primary === "cx" ? "cy" : "cx";
  const sgn = (k: "cx" | "cy") => ((k === "cx" ? flipX : flipY) ? -1 : 1);
  // agrupar por línea primaria
  const lines = new Map<number, typeof items>();
  for (const it of items) {
    const k = key(it[primary]);
    lines.set(k, [...(lines.get(k) ?? []), it]);
  }
  const sortedKeys = [...lines.keys()].sort((a, b) => (a - b) * sgn(primary));
  const out = new Map<string, number>();
  let n = 1;
  sortedKeys.forEach((k, li) => {
    const line = lines.get(k)!.sort((a, b) => (a[secondary] - b[secondary]) * sgn(secondary));
    if (order === "serpentina" && li % 2 === 1) line.reverse();
    for (const it of line) out.set(it.id, n++);
  });
  return out;
}

export interface SizeOption { label: string; cols: number; rows: number; widthMm: number; heightMm: number; dW: number; dH: number }

/** Sugerencias por debajo, por encima y más cercana. Nunca fracciones de gabinete. */
export function suggestSizes(p: Panel, wantWmm: number, wantHmm: number, rotated = false): SizeOption[] {
  const w = rotated ? p.heightMm : p.widthMm, h = rotated ? p.widthMm : p.heightMm;
  const mk = (label: string, cols: number, rows: number): SizeOption => ({
    label, cols, rows, widthMm: cols * w, heightMm: rows * h, dW: cols * w - wantWmm, dH: rows * h - wantHmm,
  });
  const fc = Math.max(1, Math.floor(wantWmm / w + 1e-9)), fr = Math.max(1, Math.floor(wantHmm / h + 1e-9));
  const cc = Math.max(1, Math.ceil(wantWmm / w - 1e-9)), cr = Math.max(1, Math.ceil(wantHmm / h - 1e-9));
  const rc = Math.max(1, Math.round(wantWmm / w)), rr = Math.max(1, Math.round(wantHmm / h));
  return [mk("Por debajo", fc, fr), mk("Más cercana", rc, rr), mk("Por encima", cc, cr)];
}

/** Proporciones cercanas a 16:9 con error real. */
export function near169(p: Panel, maxCols = 40) {
  const res: { cols: number; rows: number; errPct: number }[] = [];
  for (let r = 1; r <= 24; r++) {
    const c = Math.round((16 / 9) * r * p.resY / p.resX);
    if (c < 1 || c > maxCols) continue;
    const a = (c * p.resX) / (r * p.resY);
    res.push({ cols: c, rows: r, errPct: ((a - 16 / 9) / (16 / 9)) * 100 });
  }
  return res.sort((a, b) => Math.abs(a.errPct) - Math.abs(b.errPct)).slice(0, 5);
}

export const fmtM = (mm: number) => (mm / 1000).toLocaleString("es-AR", { maximumFractionDigits: 3 }) + " m";
export const fmtN = (n: number) => n.toLocaleString("es-AR");

export function gridColsRows(s: Screen, lookup: PanelLookup) {
  const xs = new Set<number>(), ys = new Set<number>();
  for (const c of s.cabinets) { xs.add(c.x); ys.add(c.y); }
  return { cols: xs.size, rows: ys.size, first: s.cabinets[0] ? lookup(s.cabinets[0].panelId) : undefined };
}

export type { Corner, NumberOrder };
