// Posiciones 3D esquemáticas (metros) de cada gabinete, derivadas del mismo modelo.
// Eje X derecha, Y arriba, Z hacia el público. Curvas: se envuelve la vista desarrollada
// sobre un arco cuyo radio sale de la apertura calculada por geometry.ts.
import { cabDims, gridColsRows, type PanelLookup } from "./engine";
import { computeCurve } from "./geometry";
import type { Project } from "./model";
import { screenColor } from "./plan";

export interface Cab3D { id: string; screenId: string; x: number; y: number; z: number; rotY: number; rotX?: number; tilt: number; w: number; h: number; color: string }

export function scene3d(p: Project, lookup: PanelLookup): Cab3D[] {
  const out: Cab3D[] = [];
  const lift = new Map<string, number>(); // pantallas de techo: altura extra para flotar sobre el suelo
  p.screens.forEach((s, si) => {
    const color = screenColor(si);
    const first = s.cabinets[0] && lookup(s.cabinets[0].panelId);
    if (!first) return;
    const dims = s.cabinets.map((c) => { const pn = lookup(c.panelId); return pn ? cabDims(c, pn) : null; });
    const L = Math.max(0, ...s.cabinets.map((c, i) => c.x + (dims[i]?.w ?? 0)));
    const H = Math.max(0, ...s.cabinets.map((c, i) => c.y + (dims[i]?.h ?? 0)));
    const { cols } = gridColsRows(s, lookup);
    const colW = dims[0]?.w ?? first.widthMm;
    const curve = s.geometry.type === "plana" ? null : computeCurve(s.geometry, cols, colW, first);
    const theta = curve ? (curve.apertureDeg * Math.PI) / 180 : 0;
    const R = theta > 1e-6 ? L / theta : 0;
    const sign = s.geometry.type === "convexa" ? -1 : 1;
    const techo = s.mount === "techo";
    if (techo) lift.set(s.id, H / 1000 + 0.5); // flota a una altura esquemática sobre el suelo
    s.cabinets.forEach((c, i) => {
      const d = dims[i]; if (!d) return;
      const cy = -(s.y + c.y + d.h / 2);
      const sc = c.x + d.w / 2;
      let x = s.x + sc, z = 0, rotY = 0;
      if (R) {
        const a = (sc - L / 2) / R;
        x = s.x + L / 2 + R * Math.sin(a);
        z = sign * R * (1 - Math.cos(a));
        rotY = -sign * a;
      }
      out.push({ id: c.id, screenId: s.id, x: x / 1000, y: cy / 1000, z: z / 1000, rotY, rotX: techo ? -Math.PI / 2 : 0, tilt: ((c.angleDeg ?? 0) * Math.PI) / 180, w: d.w / 1000, h: d.h / 1000, color });
    });
  });
  const floor = Math.min(...out.map((c) => c.y - c.h / 2));
  return out.map((c) => ({ ...c, y: c.y - floor + (lift.get(c.screenId) ?? 0) })); // la base más baja apoya en el suelo (y = 0)
}
