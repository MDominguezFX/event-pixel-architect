// Geometría plana y curva (vista superior). Unidades: mm y grados.
import type { Panel } from "./catalog";
import type { Geometry } from "./model";

export interface Pt { x: number; y: number }
export interface CurveResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  developedMm: number;
  points: Pt[]; // facetada: vértices de la polilínea; continua: muestreo del arco
  faceted: boolean;
  turnDeg: number; // giro entre gabinetes (facetada)
  apertureDeg: number;
  radiusMm: number | null; // continua: radio; facetada: radio a caras
  radiusVertexMm: number | null; // facetada: radio a vértices
  radiusRef: string;
  chordMm: number;
  frontWidthMm: number; // ancho frontal proyectado (envolvente)
  depthMm: number;
  outerDiameterMm: number | null;
  closes: boolean;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function bbox(pts: Pt[]) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export function computeCurve(g: Geometry, cols: number, colWidthMm: number, panel?: Panel): CurveResult {
  const L = cols * colWidthMm;
  const errors: string[] = [], warnings: string[] = [];
  const base: CurveResult = {
    valid: true, errors, warnings, developedMm: L, points: [{ x: 0, y: 0 }, { x: L, y: 0 }], faceted: g.mode === "facetada",
    turnDeg: 0, apertureDeg: 0, radiusMm: null, radiusVertexMm: null, radiusRef: "-", chordMm: L, frontWidthMm: L, depthMm: 0,
    outerDiameterMm: null, closes: false,
  };
  if (g.type === "plana") return base;

  if (panel) {
    if (!panel.curvable) warnings.push("Compatibilidad mecánica pendiente de confirmar: el panel no declara admitir curvatura.");
    else if (g.mode === "continua" && panel.construction !== "flexible") warnings.push("El panel es rígido: la curvatura continua no representa su construcción real.");
    else if (g.mode === "facetada" && panel.construction === "flexible") warnings.push("El panel es flexible: considere curvatura continua.");
  }
  const sign = g.type === "convexa" ? -1 : 1;

  if (g.mode === "facetada") {
    let turn = g.angleDeg;
    if (g.type === "cilindro") {
      turn = 360 / cols;
      if (cols < 3) errors.push("Un cilindro facetado necesita al menos 3 columnas.");
    } else if (g.input === "apertura") {
      turn = cols > 1 ? g.apertureDeg / (cols - 1) : 0;
    }
    if (panel?.angleMaxDeg != null && turn > panel.angleMaxDeg + 1e-9) errors.push(`El ángulo requerido (${turn.toFixed(2)}°) supera el máximo del panel (${panel.angleMaxDeg}°).`);
    if (panel?.angleMinDeg != null && turn < panel.angleMinDeg - 1e-9) errors.push(`El ángulo (${turn.toFixed(2)}°) es menor al mínimo del panel (${panel.angleMinDeg}°).`);
    if (panel?.angleStepDeg && Math.abs(turn / panel.angleStepDeg - Math.round(turn / panel.angleStepDeg)) > 1e-6)
      errors.push(`El ángulo ${turn.toFixed(2)}° no es múltiplo del incremento permitido (${panel.angleStepDeg}°).`);
    if (g.type !== "cilindro" && turn * (cols - 1) >= 360) errors.push("La apertura acumulada alcanza o supera 360°: use tipo cilindro.");
    const pts: Pt[] = [{ x: 0, y: 0 }];
    let a = 0;
    for (let i = 0; i < cols; i++) {
      const p = pts[pts.length - 1]!;
      pts.push({ x: p.x + colWidthMm * Math.cos(rad(a)), y: p.y + sign * colWidthMm * Math.sin(rad(a)) });
      a += turn;
    }
    const last = pts[pts.length - 1]!;
    const closes = g.type === "cilindro" && Math.hypot(last.x, last.y) < 1e-6 * L + 1e-6;
    const bb = bbox(pts);
    const n = g.type === "cilindro" ? cols : 0;
    const rFace = n ? colWidthMm / (2 * Math.tan(Math.PI / n)) : null;
    const rVert = n ? colWidthMm / (2 * Math.sin(Math.PI / n)) : null;
    return {
      ...base, valid: errors.length === 0, points: pts, turnDeg: turn,
      apertureDeg: g.type === "cilindro" ? 360 : turn * (cols - 1),
      radiusMm: rFace, radiusVertexMm: rVert,
      radiusRef: n ? "Radio al centro de caras (apotema) / a vértices" : "No aplica (facetada abierta)",
      chordMm: Math.hypot(last.x, last.y), frontWidthMm: bb.w, depthMm: bb.h,
      outerDiameterMm: rVert ? 2 * rVert : null, closes,
    };
  }

  // Continua
  let R = g.radiusMm, theta: number;
  if (g.type === "cilindro") { R = L / (2 * Math.PI); theta = 2 * Math.PI; }
  else if (g.input === "apertura") { theta = rad(g.apertureDeg); R = L / theta; }
  else { if (!(R > 0)) errors.push("El radio debe ser positivo."); theta = L / R; }
  if (g.type !== "cilindro" && theta >= 2 * Math.PI - 1e-9) errors.push("Con ese radio la apertura llega a 360° o más: use cilindro o aumente el radio.");
  if (panel?.minRadiusMm != null && R < panel.minRadiusMm) errors.push(`El radio (${R.toFixed(0)} mm) es menor al mínimo del panel (${panel.minRadiusMm} mm).`);
  const pts: Pt[] = [];
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const t = -theta / 2 + (theta * i) / N;
    pts.push({ x: R * Math.sin(t), y: sign * R * (1 - Math.cos(t)) });
  }
  const chord = theta >= 2 * Math.PI ? 0 : 2 * R * Math.sin(theta / 2);
  const front = theta <= Math.PI ? chord : 2 * R;
  const depth = theta >= 2 * Math.PI ? 2 * R : R * (1 - Math.cos(Math.min(theta, 2 * Math.PI) / 2));
  return {
    ...base, valid: errors.length === 0, points: pts, faceted: false, apertureDeg: deg(theta), radiusMm: R, radiusRef: "Radio a la superficie LED",
    chordMm: chord, frontWidthMm: front, depthMm: depth, outerDiameterMm: g.type === "cilindro" ? 2 * R : null,
    closes: g.type === "cilindro",
  };
}
