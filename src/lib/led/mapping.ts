// Canvas de contenido y mapa de salida. Coordenadas enteras en píxeles,
// origen arriba-izquierda, x hacia la derecha, y hacia abajo, w/h exclusivos.
import { cabDims, pixelOrigin, screenStats, type PanelLookup } from "./engine";
import { uid, type Project, type Rect, type Slice } from "./model";

export function slicesByScreen(p: Project, lookup: PanelLookup): Slice[] {
  let x = 0;
  return p.screens.map((s) => {
    const st = screenStats(s, lookup);
    const r: Rect = { x, y: 0, w: st.resX, h: st.resY };
    x += st.resX;
    return { id: uid(), name: s.name, screenId: s.id, input: { ...r }, output: { ...r }, outputIndex: 0 };
  });
}

export function slicesByCabinet(p: Project, lookup: PanelLookup): Slice[] {
  let ox = 0;
  const out: Slice[] = [];
  for (const s of p.screens) {
    const st = screenStats(s, lookup);
    const minX = Math.min(...s.cabinets.map((c) => c.x)), minY = Math.min(...s.cabinets.map((c) => c.y));
    s.cabinets.forEach((c, i) => {
      const d = cabDims(c, lookup(c.panelId)!);
      const r: Rect = { x: ox + pixelOrigin(s, lookup, c, "x", minX), y: pixelOrigin(s, lookup, c, "y", minY), w: d.rx, h: d.ry };
      out.push({ id: uid(), name: `${s.name} #${i + 1}`, screenId: s.id, input: { ...r }, output: { ...r }, outputIndex: 0 });
    });
    ox += st.resX;
  }
  return out;
}

export const normDeg = (d: number) => Math.round((((d % 360) + 360) % 360) * 100) / 100;
const rot = (x: number, y: number, cx: number, cy: number, deg: number) => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: Math.round((cx + (x - cx) * c - (y - cy) * s) * 100) / 100, y: Math.round((cy + (x - cx) * s + (y - cy) * c) * 100) / 100 };
};

/** Output quad corners (input TL, TR, BR, BL) after rotating the output box about its center. */
export function outputQuad(s: Slice): { x: number; y: number }[] {
  const r = s.output, cx = r.x + r.w / 2, cy = r.y + r.h / 2, a = s.rotation ?? 0;
  return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].map(([x, y]) => (a ? rot(x!, y!, cx, cy, a) : { x: x!, y: y! }));
}

/** Rotate selected slices by delta degrees: one slice spins in place, a group spins around its common center. */
export function rotateSlices(slices: Slice[], ids: Set<string>, delta: number): Slice[] {
  const sel = slices.filter((s) => ids.has(s.id));
  if (!sel.length) return slices;
  const cx = sel.reduce((a, s) => a + s.output.x + s.output.w / 2, 0) / sel.length;
  const cy = sel.reduce((a, s) => a + s.output.y + s.output.h / 2, 0) / sel.length;
  return slices.map((s) => {
    if (!ids.has(s.id)) return s;
    const c = rot(s.output.x + s.output.w / 2, s.output.y + s.output.h / 2, cx, cy, delta);
    return { ...s, rotation: normDeg((s.rotation ?? 0) + delta), output: { ...s.output, x: Math.round(c.x - s.output.w / 2), y: Math.round(c.y - s.output.h / 2) } };
  });
}

/** Rotate a single slice by delta degrees (default 90) in place. */
export const rotateSlice = (s: Slice, delta = 90): Slice => ({ ...s, rotation: normDeg((s.rotation ?? 0) + delta) });

const inter = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function mappingWarnings(p: Project): string[] {
  const m = p.mapping, w: string[] = [];
  m.slices.forEach((s) => {
    const all = [s.input.x, s.input.y, s.input.w, s.input.h, s.output.x, s.output.y, s.output.w, s.output.h];
    if (!all.every(Number.isInteger)) w.push(`${s.name}: coordenadas no enteras.`);
    if (s.input.x < 0 || s.input.y < 0 || s.input.x + s.input.w > m.canvasW || s.input.y + s.input.h > m.canvasH) w.push(`${s.name}: la entrada sale del canvas (${m.canvasW}×${m.canvasH}).`);
    const o = m.outputs[s.outputIndex];
    if (!o) w.push(`${s.name}: salida asignada inexistente.`);
    else if (outputQuad(s).some((q) => q.x < -0.01 || q.y < -0.01 || q.x > o.w + 0.01 || q.y > o.h + 0.01)) w.push(`${s.name}: la salida excede ${o.name} (${o.w}×${o.h}).`);
    if (s.input.w !== s.output.w || s.input.h !== s.output.h) w.push(`${s.name}: escalado ${s.input.w}×${s.input.h} → ${s.output.w}×${s.output.h}.`);
  });
  for (let i = 0; i < m.slices.length; i++)
    for (let j = i + 1; j < m.slices.length; j++) {
      const a = m.slices[i]!, b = m.slices[j]!;
      if (a.outputIndex === b.outputIndex && inter(a.output, b.output)) w.push(`Superposición en salida: ${a.name} / ${b.name}.`);
    }
  return w;
}

export function slicesCsv(p: Project): string {
  const h = "nombre,pantalla,in_x,in_y,in_w,in_h,salida,out_x,out_y,out_w,out_h,rotacion";
  const rows = p.mapping.slices.map((s) => {
    const sc = p.screens.find((x) => x.id === s.screenId)?.name ?? "";
    const o = p.mapping.outputs[s.outputIndex]?.name ?? "";
    return [s.name, sc, s.input.x, s.input.y, s.input.w, s.input.h, o, s.output.x, s.output.y, s.output.w, s.output.h, s.rotation ?? 0].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });
  return [h, ...rows].join("\n");
}
