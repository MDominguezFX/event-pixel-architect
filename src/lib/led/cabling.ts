import { cabDims, numberCabinets, type PanelLookup } from "./engine";
import type { Cabinet, Screen } from "./model";

export const MAX_PIXELS_PER_CABLE = 650_000;
export interface CableRun { port: number; pixels: number; cabinets: Cabinet[] }

/** Whole cabinets, native pixels, following the project's configured numbering. */
export function cableRuns(screen: Screen, lookup: PanelLookup) {
  const errors: string[] = [];
  for (const cabinet of screen.cabinets) {
    const panel = lookup(cabinet.panelId);
    if (!panel) errors.push(`Gabinete ${cabinet.id}: panel desconocido.`);
    else if (panel.resX * panel.resY > MAX_PIXELS_PER_CABLE) errors.push(`${panel.name}: un gabinete supera 650.000 píxeles; requiere dividir su carga según la receptora.`);
  }
  if (errors.length) return { runs: [] as CableRun[], errors };
  // El cableado de datos siempre recorre en serpentina (sinusoidal); solo la esquina de inicio es configurable.
  const numbers = numberCabinets({ ...screen, numbering: { ...screen.numbering, order: "serpentina" } }, lookup);
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
  return { runs, errors };
}

export const CABLING_NOTE = "Propuesta de datos · 650.000 px/cable. Confirmar controladora, receptoras, frecuencia y profundidad de color. No incluye alimentación ni redundancia.";