// Generador de planos: produce primitivas vectoriales en mm desde el modelo.
// Las mismas primitivas se dibujan en pantalla (SVG), PNG (canvas) y PDF (jsPDF).
import { realPitch } from "./catalog";
import { cabDims, numberCabinets, screenStats, fmtM, type PanelLookup } from "./engine";
import { computeCurve } from "./geometry";
import type { Project, Screen } from "./model";
import { cableRuns, CABLING_NOTE } from "./cabling";

export type Prim =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; hatch?: boolean }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; lw: number; dash?: boolean }
  | { t: "poly"; pts: { x: number; y: number }[]; stroke: string; lw: number; closed?: boolean; fill?: string }
  | { t: "text"; x: number; y: number; s: string; size: number; color: string; align?: "left" | "center" | "right"; bold?: boolean; rot?: number };

export interface Plan { prims: Prim[]; minX: number; minY: number; maxX: number; maxY: number; title: string }

export const TYPE_COLORS = ["#189BEA", "#22C1FF", "#015FBF", "#7FB8E6", "#0B3E7A", "#9ADCF7"];
// Matches the semantic scene color tokens; shared by SVG and document renderers.
export const SCREEN_COLORS = ["#015FBF", "#087F6B", "#B54D1C", "#AD3975", "#6D50B5", "#496575"];
export const screenColor = (index: number) => SCREEN_COLORS[((index % SCREEN_COLORS.length) + SCREEN_COLORS.length) % SCREEN_COLORS.length] ?? SCREEN_COLORS[0] ?? "#015FBF";
/** Distinct, high-contrast colors per data port (P1, P2…), shared by screen and documents. */
export const PORT_COLORS = ["#189BEA", "#E5484D", "#30A46C", "#F5A524", "#8E4EC6", "#12A594", "#D6409F", "#3E63DD", "#AD7F58", "#5B6B7A"];
export const portColor = (port: number) => PORT_COLORS[(port - 1) % PORT_COLORS.length] ?? PORT_COLORS[0]!;
export interface PlanOpts { dims: boolean; numbers: boolean; ink: string; muted: string }

function dimH(p: Prim[], x1: number, x2: number, y: number, label: string, fs: number, o: PlanOpts) {
  p.push({ t: "line", x1, y1: y, x2, y2: y, stroke: o.ink, lw: fs * 0.06 });
  p.push({ t: "line", x1, y1: y - fs * 0.4, x2: x1, y2: y + fs * 0.4, stroke: o.ink, lw: fs * 0.06 });
  p.push({ t: "line", x1: x2, y1: y - fs * 0.4, x2, y2: y + fs * 0.4, stroke: o.ink, lw: fs * 0.06 });
  p.push({ t: "text", x: (x1 + x2) / 2, y: y - fs * 0.35, s: label, size: fs, color: o.ink, align: "center" });
}
function dimV(p: Prim[], y1: number, y2: number, x: number, label: string, fs: number, o: PlanOpts) {
  p.push({ t: "line", x1: x, y1, x2: x, y2, stroke: o.ink, lw: fs * 0.06 });
  p.push({ t: "line", x1: x - fs * 0.4, y1, x2: x + fs * 0.4, y2: y1, stroke: o.ink, lw: fs * 0.06 });
  p.push({ t: "line", x1: x - fs * 0.4, y1: y2, x2: x + fs * 0.4, y2, stroke: o.ink, lw: fs * 0.06 });
  p.push({ t: "text", x: x - fs * 0.35, y: (y1 + y2) / 2, s: label, size: fs, color: o.ink, align: "center", rot: -90 });
}

export function typeColorMap(s: Screen) {
  const m = new Map<string, string>();
  for (const c of s.cabinets) {
    const k = c.panelId + (c.rotated ? "@r" : "");
    if (!m.has(k)) m.set(k, TYPE_COLORS[m.size % TYPE_COLORS.length]!);
  }
  return m;
}

/** Plano frontal desarrollado acotado. */
export function frontPlan(s: Screen, lookup: PanelLookup, o: PlanOpts): Plan {
  const st = screenStats(s, lookup);
  const W = st.widthMm, H = st.heightMm;
  const fs = Math.max(W, H) / 45;
  const prims: Prim[] = [];
  const colors = typeColorMap(s);
  const nums = numberCabinets(s, lookup);
  const xs = new Set<number>([0]), ys = new Set<number>([0]);
  for (const c of s.cabinets) {
    const p = lookup(c.panelId); if (!p) continue;
    const d = cabDims(c, p);
    xs.add(c.x + d.w); ys.add(c.y + d.h);
    const col = colors.get(c.panelId + (c.rotated ? "@r" : ""))!;
    prims.push({ t: "rect", x: c.x, y: c.y, w: d.w, h: d.h, fill: col, stroke: o.ink, lw: fs * 0.05, hatch: [...colors.keys()].indexOf(c.panelId + (c.rotated ? "@r" : "")) % 2 === 1 });
    if (o.numbers) {
      const n = nums.get(c.id) ?? 0;
      const ts = Math.min(d.w, d.h) / 4;
      prims.push({ t: "text", x: c.x + d.w / 2, y: c.y + d.h / 2 + ts * 0.35, s: String(n), size: ts, color: "#ffffff", align: "center", bold: true });
    }
  }
  if (o.dims) {
    dimH(prims, 0, W, -fs * 3.2, `${fmtM(W)} · ${st.resX} px`, fs, o);
    dimV(prims, 0, H, -fs * 3.2, `${fmtM(H)} · ${st.resY} px`, fs, o);
    // cotas por columnas (abajo) y bandas (derecha), en mm
    const sx = [...xs].sort((a, b) => a - b), sy = [...ys].sort((a, b) => a - b);
    const small = fs * 0.7;
    for (let i = 0; i < sx.length - 1; i++) if (sx.length <= 41) dimH(prims, sx[i]!, sx[i + 1]!, H + fs * 1.6, `${Math.round(sx[i + 1]! - sx[i]!)}`, small, o);
    for (let i = 0; i < sy.length - 1; i++) dimV(prims, sy[i]!, sy[i + 1]!, W + fs * 1.6, `${Math.round(sy[i + 1]! - sy[i]!)}`, small, o);
  }
  // Leyenda
  let ly = H + fs * 4;
  for (const t of st.types) {
    const k = t.panel.id + (t.rotated ? "@r" : "");
    const d = t.rotated ? `${t.panel.heightMm}×${t.panel.widthMm}` : `${t.panel.widthMm}×${t.panel.heightMm}`;
    const r = t.rotated ? `${t.panel.resY}×${t.panel.resX}` : `${t.panel.resX}×${t.panel.resY}`;
    prims.push({ t: "rect", x: 0, y: ly - fs * 0.8, w: fs, h: fs, fill: colors.get(k), stroke: o.ink, lw: fs * 0.05 });
    prims.push({ t: "text", x: fs * 1.5, y: ly, s: `${t.count} × ${t.panel.name} — ${d} mm — ${r} px — pitch ${realPitch(t.panel).x.toFixed(3)} mm`, size: fs * 0.8, color: o.ink });
    ly += fs * 1.4;
  }
  prims.push({ t: "text", x: 0, y: ly + fs * 0.2, s: `${s.name}: ${st.count} gabinetes · ${st.areaM2.toFixed(2)} m² · ${st.resX}×${st.resY} px (${st.activePixels.toLocaleString("es-AR")} px activos)`, size: fs * 0.85, color: o.ink, bold: true });
  return { prims, minX: -fs * 5, minY: -fs * 5, maxX: W + fs * 4, maxY: ly + fs * 1.5, title: `${s.name} — vista frontal desarrollada` };
}

/** Vista superior para curvas. */
export function topPlan(s: Screen, lookup: PanelLookup, o: PlanOpts): Plan | null {
  if (s.geometry.type === "plana") return null;
  const first = s.cabinets[0] && lookup(s.cabinets[0].panelId);
  const rowY = s.cabinets[0]?.y ?? 0;
  const row = s.cabinets.filter((c) => c.y === rowY).sort((a, b) => a.x - b.x);
  const colW = first ? cabDims(s.cabinets[0]!, first).w : 500;
  const cr = computeCurve(s.geometry, row.length, colW, first);
  const pts = cr.points;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const fs = Math.max(maxX - minX, maxY - minY, 1000) / 35;
  const prims: Prim[] = [];
  prims.push({ t: "poly", pts, stroke: TYPE_COLORS[0]!, lw: fs * 0.25, closed: false });
  if (cr.faceted) {
    pts.forEach((p, i) => {
      prims.push({ t: "rect", x: p.x - fs * 0.15, y: p.y - fs * 0.15, w: fs * 0.3, h: fs * 0.3, fill: o.ink });
      if (o.numbers && i < pts.length - 1) {
        const q = pts[i + 1]!;
        prims.push({ t: "text", x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - fs * 0.5, s: String(i + 1), size: fs * 0.6, color: o.ink, align: "center" });
      }
    });
  }
  if (s.geometry.type === "cilindro") {
    const p0 = pts[0]!;
    prims.push({ t: "text", x: p0.x, y: p0.y - fs * 1.2, s: "Unión · inicio →", size: fs * 0.7, color: "#E5484D", align: "center", bold: true });
    prims.push({ t: "rect", x: p0.x - fs * 0.3, y: p0.y - fs * 0.3, w: fs * 0.6, h: fs * 0.6, fill: "#E5484D" });
  }
  if (o.dims) {
    dimH(prims, minX, maxX, minY - fs * 2.5, `Frente ${fmtM(cr.frontWidthMm)}`, fs, o);
    dimV(prims, minY, maxY, minX - fs * 2.5, `Prof. ${fmtM(cr.depthMm)}`, fs, o);
  }
  const lines = [
    `Desarrollado: ${fmtM(cr.developedMm)} · Apertura: ${cr.apertureDeg.toFixed(2)}°`,
    cr.faceted ? `Facetada · giro entre gabinetes ${cr.turnDeg.toFixed(2)}°` : `Continua · radio ${cr.radiusMm ? fmtM(cr.radiusMm) : "-"}`,
    cr.radiusMm && cr.faceted ? `Radio a caras ${fmtM(cr.radiusMm)} · a vértices ${fmtM(cr.radiusVertexMm!)}` : `Cuerda ${fmtM(cr.chordMm)}`,
    ...cr.errors, ...cr.warnings,
  ];
  let y = maxY + fs * 2;
  for (const l of lines) { prims.push({ t: "text", x: minX, y, s: l, size: fs * 0.75, color: o.ink }); y += fs * 1.2; }
  return { prims, minX: minX - fs * 4, minY: minY - fs * 4, maxX: maxX + fs * 2, maxY: y, title: `${s.name} — vista superior (esquema)` };
}

/** Layout general de varias pantallas con posiciones respecto del origen. */
export function layoutPlan(p: Project, lookup: PanelLookup, o: PlanOpts): Plan {
  const prims: Prim[] = [];
  let minX = 0, minY = 0, maxX = 1, maxY = 1;
  for (const s of p.screens) {
    const st = screenStats(s, lookup);
    minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + st.widthMm); maxY = Math.max(maxY, s.y + st.heightMm);
  }
  const fs = Math.max(maxX - minX, maxY - minY) / 50;
  prims.push({ t: "line", x1: -fs * 2, y1: 0, x2: fs * 2, y2: 0, stroke: "#E5484D", lw: fs * 0.1 });
  prims.push({ t: "line", x1: 0, y1: -fs * 2, x2: 0, y2: fs * 2, stroke: "#E5484D", lw: fs * 0.1 });
  prims.push({ t: "text", x: fs * 0.5, y: -fs * 0.5, s: "Origen (0,0)", size: fs * 0.7, color: "#E5484D" });
  p.screens.forEach((s, i) => {
    const st = screenStats(s, lookup);
    prims.push({ t: "rect", x: s.x, y: s.y, w: st.widthMm, h: st.heightMm, fill: screenColor(i), stroke: o.ink, lw: fs * 0.08 });
    prims.push({ t: "text", x: s.x + st.widthMm / 2, y: s.y + st.heightMm / 2, s: s.name, size: fs, color: "#ffffff", align: "center", bold: true });
    prims.push({ t: "text", x: s.x, y: s.y + st.heightMm + fs * 1.2, s: `X ${fmtM(s.x)} · Y ${fmtM(s.y)} · ${fmtM(st.widthMm)} × ${fmtM(st.heightMm)}`, size: fs * 0.6, color: o.ink });
  });
  return { prims, minX: minX - fs * 3, minY: minY - fs * 3, maxX: maxX + fs * 3, maxY: maxY + fs * 3, title: "Layout general (posiciones desde el origen)" };
}

/** Developed front view: numbered whole-cabinet chains, arrows and port loads. */
export function wiringPlan(s: Screen, lookup: PanelLookup, o: PlanOpts, index = 0): Plan {
  const stats = screenStats(s, lookup), fs = Math.max(stats.widthMm, stats.heightMm, 1000) / 45;
  const { runs, errors } = cableRuns(s, lookup);
  const prims: Prim[] = [];
  const color = screenColor(index);
  const portOf = new Map<string, number>();
  runs.forEach((r) => r.cabinets.forEach((c) => portOf.set(c.id, r.port)));
  let minX = 0, minY = 0, maxX = stats.widthMm, maxY = stats.heightMm;
  for (const c of s.cabinets) {
    const panel = lookup(c.panelId); if (!panel) continue;
    const d = cabDims(c, panel);
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + d.w); maxY = Math.max(maxY, c.y + d.h);
    const port = portOf.get(c.id);
    prims.push({ t: "rect", x: c.x, y: c.y, w: d.w, h: d.h, fill: port ? portColor(port) : color, stroke: o.ink, lw: fs * 0.05 });
  }
  for (const run of runs) {
    const centers = run.cabinets.flatMap((c) => {
      const panel = lookup(c.panelId); if (!panel) return [];
      const d = cabDims(c, panel);
      return [{ x: c.x + d.w / 2, y: c.y + d.h / 2, w: d.w, h: d.h }];
    });
    centers.forEach((point, i) => {
      const next = centers[i + 1];
      if (next) {
        prims.push({ t: "line", x1: point.x, y1: point.y, x2: next.x, y2: next.y, stroke: "#ffffff", lw: fs * 0.07 });
        const dx = next.x - point.x, dy = next.y - point.y, length = Math.hypot(dx, dy);
        if (length) {
          const ux = dx / length, uy = dy / length, x = point.x + dx * 0.65, y = point.y + dy * 0.65, a = Math.min(point.w, point.h) * 0.08;
          prims.push({ t: "poly", pts: [{ x: x - ux * a - uy * a * 0.6, y: y - uy * a + ux * a * 0.6 }, { x, y }, { x: x - ux * a + uy * a * 0.6, y: y - uy * a - ux * a * 0.6 }], stroke: "#ffffff", lw: fs * 0.08 });
        }
      }
      const size = Math.min(point.w, point.h) / 7;
      prims.push({ t: "text", x: point.x, y: point.y - size * 0.8, s: `P${run.port}:${String(i + 1).padStart(2, "0")}${i === 0 ? " IN" : ""}`, size, color: "#ffffff", align: "center", bold: true });
    });
  }
  let y = maxY + fs * 2;
  prims.push({ t: "text", x: minX, y, s: `${s.name} · ${stats.resX}×${stats.resY} px · ${runs.length} cables / puertos de datos`, size: fs, color: o.ink, bold: true });
  for (const run of runs) { y += fs * 1.4; prims.push({ t: "rect", x: minX, y: y - fs * 0.8, w: fs, h: fs, fill: portColor(run.port), stroke: o.ink, lw: fs * 0.05 }); prims.push({ t: "text", x: minX + fs * 1.5, y, s: `P${run.port} · IN → ${run.cabinets.length} gabinetes · ${run.pixels.toLocaleString("es-AR")} / 650.000 px`, size: fs * 0.85, color: o.ink }); }
  for (const text of [...errors, ...CABLING_NOTE.split(" · ")]) { y += fs * 1.4; prims.push({ t: "text", x: minX, y, s: text, size: fs * 0.65, color: o.ink }); }
  return { prims, minX: minX - fs * 2, minY: minY - fs * 2, maxX: Math.max(maxX + fs * 2, minX + fs * 55), maxY: y + fs * 2, title: `${s.name} — cableado de datos (vista frontal desarrollada)` };
}
