import { cabDims, numberCabinets, type PanelLookup } from "./engine";
import type { Cabinet, Corner, Screen } from "./model";

export const MAX_PIXELS_PER_CABLE = 650_000;
export interface CableRun { port: number; pixels: number; cabinets: Cabinet[] }
export interface CableRoute { start: Corner; axis: "columnas" | "filas" }

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];

function group(screen: Screen, lookup: PanelLookup, route: CableRoute) {
  const numbers = numberCabinets({ ...screen, numbering: { ...screen.numbering, order: "serpentina", start: route.start } }, lookup, route.axis === "columnas" ? "cx" : "cy");
  const ordered = [...screen.cabinets].sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0));
  const runs: CableRun[] = [];
  for (const cabinet of ordered) {
    const panel = lookup(cabinet.panelId);
    if (!panel) continue;
    const d = cabDims(cabinet, panel), pixels = d.rx * d.ry;
    let run = runs.at(-1);
    if (!run || run.pixels + pixels > MAX_PIXELS_PER_CABLE) {
      run = { port: runs.length + 1, pixels: 0, cabinets: [] };
      runs.push(run);
    }
    run.cabinets.push(cabinet); run.pixels += pixels;
  }
  return runs;
}

/**
 * Cableado siempre en serpentina con gabinetes completos y ≤ 650.000 px por cable.
 * Optimiza probando las 4 esquinas × 2 sentidos: menos puertos primero, luego carga más pareja;
 * ante empate se respeta la esquina configurada.
 */
export function cableRuns(screen: Screen, lookup: PanelLookup) {
  const errors: string[] = [];
  for (const cabinet of screen.cabinets) {
    const panel = lookup(cabinet.panelId);
    if (!panel) errors.push(`Gabinete ${cabinet.id}: panel desconocido.`);
    else if (panel.resX * panel.resY > MAX_PIXELS_PER_CABLE) errors.push(`${panel.name}: un gabinete supera 650.000 píxeles; requiere dividir su carga según la receptora.`);
  }
  const fallback: CableRoute = { start: screen.numbering.start, axis: "columnas" };
  if (errors.length) return { runs: [] as CableRun[], errors, route: fallback };
  const pref = screen.numbering.start;
  const candidates: CableRoute[] = [pref, ...CORNERS.filter((c) => c !== pref)].flatMap((start) => [{ start, axis: "columnas" as const }, { start, axis: "filas" as const }]);
  let best = { route: fallback, runs: group(screen, lookup, fallback) };
  const score = (r: CableRun[]) => [r.length, Math.max(0, ...r.map((x) => x.pixels)) - Math.min(...r.map((x) => x.pixels))];
  for (const route of candidates) {
    const runs = group(screen, lookup, route);
    const [a, b] = score(runs), [c, d] = score(best.runs);
    if (a < c || (a === c && b < d)) best = { route, runs };
  }
  return { runs: best.runs, errors, route: best.route };
}

export const CORNER_LABEL: Record<Corner, string> = { tl: "arriba izq.", tr: "arriba der.", bl: "abajo izq.", br: "abajo der." };
export const CABLING_NOTE = "Propuesta de datos optimizada · serpentina · 650.000 px/cable. Confirmar controladora, receptoras, frecuencia y profundidad de color. No incluye alimentación ni redundancia.";
