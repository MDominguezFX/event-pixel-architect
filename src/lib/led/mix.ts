// Algoritmo de mezcla 500×500 / 500×1000 sobre grilla base de 500×500 mm.
import { realPitch, type Panel } from "./catalog";
import { uid, type Cabinet } from "./model";

export type MixGoal = "menos" | "stock" | "grandes" | "chicos";

export interface Compat { ok: boolean; reasons: string[] }

export function mixCompat(small: Panel, large: Panel, userConfirmed: boolean): Compat {
  const r: string[] = [];
  const ps = realPitch(small), pl = realPitch(large);
  if (Math.abs(ps.x - pl.x) > 1e-6 || Math.abs(ps.y - pl.y) > 1e-6) r.push("El pitch real no coincide.");
  if (!(large.widthMm === small.widthMm && large.heightMm === 2 * small.heightMm)) r.push("Las medidas no son 1× y 2× de la celda base.");
  if (!(large.resX === small.resX && large.resY === 2 * small.resY)) r.push("Las resoluciones no son coherentes (el grande debe tener el doble de píxeles verticales).");
  const famOk = !!small.family && small.family === large.family && (!!(small.familyConfirmed && large.familyConfirmed) || userConfirmed);
  if (!famOk) r.push("Compatibilidad mecánica y de montaje no confirmada (misma familia + confirmación).");
  return { ok: r.length === 0, reasons: r };
}

export interface MixOption {
  name: string;
  cols: number;
  rows: number; // filas de 500
  bands: number; // bandas de 1000
  large: number;
  small: number;
  total: number;
  widthMm: number;
  heightMm: number;
  resX: number;
  resY: number;
  dW: number;
  dH: number;
  feasible: boolean;
  shortage: { large: number; small: number };
}

export interface MixInput {
  small: Panel;
  large: Panel;
  wantWmm: number;
  wantHmm: number;
  goal: MixGoal;
  stockSmall?: number | null;
  stockLarge?: number | null;
}

function option(name: string, inp: MixInput, cols: number, rows: number, bands: number): MixOption {
  const large = cols * bands, small = cols * (rows - 2 * bands);
  const sL = inp.stockLarge ?? Infinity, sS = inp.stockSmall ?? Infinity;
  const shortage = { large: Math.max(0, large - sL), small: Math.max(0, small - sS) };
  return {
    name, cols, rows, bands, large, small, total: large + small,
    widthMm: cols * inp.small.widthMm, heightMm: rows * inp.small.heightMm,
    resX: cols * inp.small.resX, resY: rows * inp.small.resY,
    dW: cols * inp.small.widthMm - inp.wantWmm, dH: rows * inp.small.heightMm - inp.wantHmm,
    feasible: shortage.large === 0 && shortage.small === 0, shortage,
  };
}

/** Devuelve alternativas: solo chicos, solo grandes (si se puede), mezcla según objetivo. */
export function mixOptions(inp: MixInput): MixOption[] {
  const cols = Math.max(1, Math.round(inp.wantWmm / inp.small.widthMm));
  const rows = Math.max(1, Math.round(inp.wantHmm / inp.small.heightMm));
  const maxB = Math.floor(rows / 2);
  const out: MixOption[] = [option("Solo 500 × 500", inp, cols, rows, 0)];
  if (rows % 2 === 0) out.push(option("Solo 500 × 1000", inp, cols, rows, maxB));
  // mezcla según objetivo
  let b = maxB;
  if (inp.goal === "chicos") b = rows % 2 === 1 && maxB > 0 ? 1 : Math.min(1, maxB);
  if (inp.goal === "stock") {
    b = -1;
    for (let k = maxB; k >= 0; k--) if (option("", inp, cols, rows, k).feasible) { b = k; break; }
    if (b < 0) b = maxB;
  }
  if (maxB > 0 && !(rows % 2 === 0 && b === maxB) && b > 0) out.push(option("Mezcla", inp, cols, rows, b));
  return out;
}

/** Genera gabinetes reales sin huecos ni superposiciones. smallBand: dónde van las filas de 500. */
export function buildMix(inp: MixInput, opt: MixOption, smallBand: "arriba" | "abajo"): Cabinet[] {
  const cw = inp.small.widthMm, ch = inp.small.heightMm;
  const smallRows = opt.rows - 2 * opt.bands;
  const cabs: Cabinet[] = [];
  for (let c = 0; c < opt.cols; c++) {
    let y = 0;
    const addSmall = () => { for (let i = 0; i < smallRows; i++) { cabs.push({ id: uid(), panelId: inp.small.id, x: c * cw, y, rotated: false }); y += ch; } };
    if (smallBand === "arriba") addSmall();
    for (let i = 0; i < opt.bands; i++) { cabs.push({ id: uid(), panelId: inp.large.id, x: c * cw, y, rotated: false }); y += 2 * ch; }
    if (smallBand === "abajo") addSmall();
  }
  return cabs;
}

/** Reemplaza un grande por dos chicos (misma posición, misma resolución). */
export function splitLarge(cabs: Cabinet[], id: string, small: Panel): Cabinet[] {
  const c = cabs.find((x) => x.id === id);
  if (!c) return cabs;
  return cabs.filter((x) => x.id !== id).concat(
    { id: uid(), panelId: small.id, x: c.x, y: c.y, rotated: false },
    { id: uid(), panelId: small.id, x: c.x, y: c.y + small.heightMm, rotated: false },
  );
}

/** Une dos chicos apilados en un grande (si existe el par). */
export function mergeSmall(cabs: Cabinet[], id: string, small: Panel, large: Panel): Cabinet[] {
  const c = cabs.find((x) => x.id === id);
  if (!c || c.panelId !== small.id) return cabs;
  const below = cabs.find((x) => x.panelId === small.id && x.x === c.x && x.y === c.y + small.heightMm);
  const above = cabs.find((x) => x.panelId === small.id && x.x === c.x && x.y === c.y - small.heightMm);
  const pair = below ?? above;
  if (!pair) return cabs;
  const top = Math.min(c.y, pair.y);
  return cabs.filter((x) => x.id !== c.id && x.id !== pair.id).concat({ id: uid(), panelId: large.id, x: c.x, y: top, rotated: false });
}
