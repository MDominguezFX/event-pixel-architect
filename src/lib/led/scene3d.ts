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
    // Inclinación de montaje de TODA la pantalla: 0° = vertical (pared), 90° = horizontal (techo).
    // "techo" equivale a 90°; mountTiltDeg permite graduaciones parciales. Gira alrededor del borde inferior.
    const tiltDeg = s.mountTiltDeg ?? (s.mount === "techo" ? 90 : 0);
    const tilt = Math.max(0, Math.min(90, tiltDeg)) * Math.PI / 180;
    if (tilt > 1e-6) lift.set(s.id, Math.max(0, s.mountHeightM ?? H / 1000 + 0.5)); // altura libre elegida por el usuario (o esquemática por defecto)
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
      // giro de montaje: la altura sobre la base (yb) pasa a profundidad (z) según el ángulo
      const yb = cy + H / 2; // 0 en la base, H en el tope (mm)
      const my = -H / 2 + yb * Math.cos(tilt);
      const mz = z + yb * Math.sin(tilt);
      out.push({ id: c.id, screenId: s.id, x: x / 1000, y: my / 1000, z: mz / 1000, rotY, rotX: -tilt, tilt: ((c.angleDeg ?? 0) * Math.PI) / 180, w: d.w / 1000, h: d.h / 1000, color });
    });
  });
  const floor = Math.min(...out.filter((c) => !lift.has(c.screenId)).map((c) => c.y - c.h / 2));
  return out.map((c) => ({ ...c, y: c.y - (lift.has(c.screenId) ? 0 : floor) + (lift.get(c.screenId) ?? 0) })); // la base más baja apoya en el suelo (y = 0); las inclinadas flotan
}
