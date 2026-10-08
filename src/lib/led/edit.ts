import { cabDims, type PanelLookup } from "./engine";
import type { Cabinet } from "./model";

type Box = { x: number; y: number; w: number; h: number };
const hits = (a: Box, b: Box) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

/** Rotate the selected cabinets 90° clockwise as one rigid block around its bounding box top-left.
 *  A single cabinet just swaps orientation in place. Returns null when the result overlaps other cabinets. */
export function rotateGroup(cabinets: Cabinet[], ids: Set<string>, lookup: PanelLookup): Cabinet[] | null {
  const box = (c: Cabinet): Box => { const p = lookup(c.panelId); const d = p ? cabDims(c, p) : { w: 0, h: 0 }; return { x: c.x, y: c.y, w: d.w, h: d.h }; };
  const sel = cabinets.filter((c) => ids.has(c.id));
  if (!sel.length) return cabinets;
  const bs = sel.map(box);
  const X = Math.min(...bs.map((b) => b.x)), Y = Math.min(...bs.map((b) => b.y));
  const H = Math.max(...bs.map((b) => b.y + b.h)) - Y;
  const out = cabinets.map((c) => {
    if (!ids.has(c.id)) return c;
    const b = box(c);
    return { ...c, rotated: !c.rotated, x: X + (H - (b.y - Y) - b.h), y: Y + (b.x - X) };
  });
  const moved = out.filter((c) => ids.has(c.id)).map(box), rest = out.filter((c) => !ids.has(c.id)).map(box);
  if (moved.some((m) => rest.some((r) => hits(m, r)))) return null;
  const mx = Math.min(...out.map((c) => c.x)), my = Math.min(...out.map((c) => c.y));
  return out.map((c) => ({ ...c, x: c.x - mx, y: c.y - my }));
}

/** Free-angle rotation (schematic): selected cabinets spin by delta degrees around their common center. */
export function rotateFree(cabinets: Cabinet[], ids: Set<string>, delta: number, lookup: PanelLookup): Cabinet[] {
  const box = (c: Cabinet): Box => { const p = lookup(c.panelId); const d = p ? cabDims(c, p) : { w: 0, h: 0 }; return { x: c.x, y: c.y, w: d.w, h: d.h }; };
  const sel = cabinets.filter((c) => ids.has(c.id));
  if (!sel.length) return cabinets;
  const cs = sel.map((c) => { const b = box(c); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
  const cx = cs.reduce((a, c) => a + c.x, 0) / cs.length, cy = cs.reduce((a, c) => a + c.y, 0) / cs.length;
  const r = (delta * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
  return cabinets.map((c) => {
    if (!ids.has(c.id)) return c;
    const b = box(c), px = b.x + b.w / 2 - cx, py = b.y + b.h / 2 - cy;
    const nx = cx + px * co - py * si, ny = cy + px * si + py * co;
    const a = Math.round(((((c.angleDeg ?? 0) + delta) % 360) + 360) % 360 * 100) / 100;
    return { ...c, angleDeg: a, x: Math.round(nx - b.w / 2), y: Math.round(ny - b.h / 2) };
  });
}
