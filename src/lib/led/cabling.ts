import { cabDims, numberCabinets, type PanelLookup } from "./engine";
import type { Cabinet, Corner, Screen } from "./model";

export const MAX_PIXELS_PER_CABLE = 650_000;
export interface CableRun { port: number; pixels: number; cabinets: Cabinet[] }
export interface CableRoute { start: Corner; axis: "columnas" | "filas" }

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];

export { screenAngle, screenFrame } from "./engine";
import { screenFrame } from "./engine";

export function cableNeighbors(a: Cabinet, b: Cabinet, lookup: PanelLookup): boolean {
  const pa = lookup(a.panelId), pb = lookup(b.panelId);
  if (!pa || !pb) return false;
  const da = cabDims(a, pa), db = cabDims(b, pb);
  const overlapX = Math.min(a.x + da.w, b.x + db.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + da.h, b.y + db.h) - Math.max(a.y, b.y);
  return ((Math.abs(a.x + da.w - b.x) < 5 || Math.abs(b.x + db.w - a.x) < 5) && overlapY > 5)
    || ((Math.abs(a.y + da.h - b.y) < 5 || Math.abs(b.y + db.h - a.y) < 5) && overlapX > 5);
}

/** Center-to-center orthogonal path, bending on the cabinets' shared edge. */
export function cablePath(a: Cabinet, b: Cabinet, lookup: PanelLookup): { x: number; y: number }[] {
  const pa = lookup(a.panelId), pb = lookup(b.panelId);
  if (!pa || !pb || !cableNeighbors(a, b, lookup)) return [];
  const da = cabDims(a, pa), db = cabDims(b, pb);
  const start = { x: a.x + da.w / 2, y: a.y + da.h / 2 }, end = { x: b.x + db.w / 2, y: b.y + db.h / 2 };
  if (start.x === end.x || start.y === end.y) return [start, end];
  const horizontal = Math.abs(a.x + da.w - b.x) < 5 || Math.abs(b.x + db.w - a.x) < 5;
  if (horizontal) {
    const x = a.x < b.x ? b.x : a.x;
    return [start, { x, y: start.y }, { x, y: end.y }, end];
  }
  const y = a.y < b.y ? b.y : a.y;
  return [start, { x: start.x, y }, { x: end.x, y }, end];
}

function group(screen: Screen, lookup: PanelLookup, route: CableRoute) {
  const numbers = numberCabinets({ ...screen, numbering: { ...screen.numbering, order: "serpentina", start: route.start } }, lookup, route.axis === "columnas" ? "cx" : "cy");
  const ordered = [...screen.cabinets].sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0));
  const runs: CableRun[] = [];
  for (const cabinet of ordered) {
    const panel = lookup(cabinet.panelId);
    if (!panel) continue;
    const d = cabDims(cabinet, panel), pixels = d.rx * d.ry;
    let run = runs.at(-1);
    const previous = run?.cabinets.at(-1);
    if (!run || run.pixels + pixels > MAX_PIXELS_PER_CABLE || (previous && !cableNeighbors(previous, cabinet, lookup))) {
      run = { port: runs.length + 1, pixels: 0, cabinets: [] };
      runs.push(run);
    }
    run.cabinets.push(cabinet); run.pixels += pixels;
  }
  return runs;
}

/**
 * Cableado siempre en serpentina con gabinetes completos y ≤ 650.000 px por cable.
 * Siempre horizontal (por filas); optimiza probando las 4 esquinas: menos puertos primero, luego carga más pareja;
 * ante empate se respeta la esquina configurada.
 */
export function cableRuns(original: Screen, lookup: PanelLookup) {
  // Route in the screen's own frame so cables stay horizontal and turn with a rotated screen.
  const screen = screenFrame(original, lookup).local;
  const back = new Map(original.cabinets.map((c) => [c.id, c]));
  const res = cableRunsLocal(screen, lookup);
  return { ...res, runs: res.runs.map((r) => ({ ...r, cabinets: r.cabinets.map((c) => back.get(c.id) ?? c) })) };
}

function cableRunsLocal(screen: Screen, lookup: PanelLookup) {
  const errors: string[] = [];
  for (const cabinet of screen.cabinets) {
    const panel = lookup(cabinet.panelId);
    if (!panel) errors.push(`Gabinete ${cabinet.id}: panel desconocido.`);
    else if (panel.resX * panel.resY > MAX_PIXELS_PER_CABLE) errors.push(`${panel.name}: un gabinete supera 650.000 píxeles; requiere dividir su carga según la receptora.`);
  }
  const fallback: CableRoute = { start: screen.numbering.start, axis: "filas" };
  if (errors.length) return { runs: [] as CableRun[], errors, route: fallback };
  const pref = screen.numbering.start;
  const candidates: CableRoute[] = [pref, ...CORNERS.filter((c) => c !== pref)].map((start) => ({ start, axis: "filas" as const }));
  let best = { route: fallback, runs: group(screen, lookup, fallback) };
  const score = (r: CableRun[]): [number, number] => [r.length, Math.max(0, ...r.map((x) => x.pixels)) - Math.min(...r.map((x) => x.pixels))];
  for (const route of candidates) {
    const runs = group(screen, lookup, route);
    const [a, b] = score(runs), [c, d] = score(best.runs);
    if (a < c || (a === c && b < d)) best = { route, runs };
  }
  return { runs: best.runs, errors, route: best.route };
}

export const CORNER_LABEL: Record<Corner, string> = { tl: "arriba izq.", tr: "arriba der.", bl: "abajo izq.", br: "abajo der." };
export const CABLING_NOTE = "Propuesta de datos optimizada · serpentina · 650.000 px/cable. Confirmar controladora, receptoras, frecuencia y profundidad de color. No incluye alimentación ni redundancia.";
