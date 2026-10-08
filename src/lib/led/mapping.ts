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

/** Output size the input occupies once rotated: 90/270 swap width and height. */
export const rotatedSize = (s: Slice): [number, number] => ((s.rotation ?? 0) % 180 ? [s.output.h, s.output.w] : [s.output.w, s.output.h]);

/** Output quad corners in the order of the input's TL, TR, BR, BL (clockwise rotation cycles corners). */
export function outputQuad(s: Slice): { x: number; y: number }[] {
  const r = s.output;
  const c = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  const k = ((s.rotation ?? 0) / 90) % 4;
  return [0, 1, 2, 3].map((i) => c[(i + k) % 4]!);
}

/** Rotate a slice 90° clockwise keeping its output top-left, swapping the output box. */
export function rotateSlice(s: Slice): Slice {
  return { ...s, rotation: (((s.rotation ?? 0) + 90) % 360) as Slice["rotation"], output: { ...s.output, w: s.output.h, h: s.output.w } };
}

const inter = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function mappingWarnings(p: Project): string[] {
  const m = p.mapping, w: string[] = [];
  m.slices.forEach((s) => {
    const all = [s.input.x, s.input.y, s.input.w, s.input.h, s.output.x, s.output.y, s.output.w, s.output.h];
    if (!all.every(Number.isInteger)) w.push(`${s.name}: coordenadas no enteras.`);
    if (s.input.x < 0 || s.input.y < 0 || s.input.x + s.input.w > m.canvasW || s.input.y + s.input.h > m.canvasH) w.push(`${s.name}: la entrada sale del canvas (${m.canvasW}×${m.canvasH}).`);
    const o = m.outputs[s.outputIndex];
    if (!o) w.push(`${s.name}: salida asignada inexistente.`);
    else if (s.output.x < 0 || s.output.y < 0 || s.output.x + s.output.w > o.w || s.output.y + s.output.h > o.h) w.push(`${s.name}: la salida excede ${o.name} (${o.w}×${o.h}).`);
    const [ew, eh] = rotatedSize(s);
    if (s.input.w !== ew || s.input.h !== eh) w.push(`${s.name}: escalado ${s.input.w}×${s.input.h} → ${s.output.w}×${s.output.h}.`);
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
