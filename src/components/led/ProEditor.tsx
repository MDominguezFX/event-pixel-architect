import { useEffect, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom as createZoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { Copy, Redo2, Trash2, Undo2, ZoomIn, ZoomOut, Plus } from "lucide-react";
import { screenStats, fmtM } from "@/lib/led/engine";
import { newScreen, uid, type Screen, type ScreenKind } from "@/lib/led/model";
import { allPanels, redo, undo, update, useStore } from "@/lib/led/store";
import { scene2d, sceneBounds, sceneDrag, sceneOffset, type SceneView } from "@/lib/led/scene2d";
import { Btn, Card, Field, inputCls, Num } from "./ui";

const KINDS: { id: ScreenKind; label: string }[] = [
  { id: "principal", label: "Principal" }, { id: "lateral", label: "Lateral" }, { id: "totem", label: "Tótem" },
  { id: "banner", label: "Banner / cenefa" }, { id: "cabina", label: "Frente cabina DJ" }, { id: "arco", label: "Arco / cilindro" }, { id: "libre", label: "Libre" },
];
const SCREEN_FILLS = ["fill-scene-1", "fill-scene-2", "fill-scene-3", "fill-scene-4", "fill-scene-5", "fill-scene-6"];

export function ProEditor({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const st = useStore();
  const panels = allPanels(st);
  const lookup = (id: string) => panels.find((p) => p.id === id);
  const p = st.project;
  const [view, setView] = useState({ x: -1000, y: -1000, k: 0.06 });
  const [snap, setSnap] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [projection, setProjection] = useState<SceneView>("espacial");
  const scene = scene2d(p, lookup, projection);
  const drag = useRef<{ id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [live, setLive] = useState<{ id: string; x: number; y: number } | null>(null);
  const sel = p.screens.find((s) => s.id === selected);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const mod = (id: string, fn: (s: Screen) => void) => update((pr) => { const screen = pr.screens.find((x) => x.id === id); if (screen) fn(screen); return pr; });
  const sn = (v: number) => (snap > 0 ? Math.round(v / snap) * snap : Math.round(v));
  const vw = 1000, vh = 560;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = createZoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [vw, vh]])
      .scaleExtent([0.005, 1])
      .filter((e) => e.type === "wheel" || (!e.button && !(e.target as Element).closest("[data-screen]")))
      .wheelDelta((e) => -e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1) * 0.0015 / Math.LN2)
      .on("zoom", (e) => setView({ k: e.transform.k, x: -e.transform.x / e.transform.k, y: -e.transform.y / e.transform.k }));
    zoomRef.current = behavior;
    select(svg).call(behavior).on("dblclick.zoom", null);
    return () => { select(svg).on(".zoom", null); zoomRef.current = null; };
  }, []);

  const onDown = (e: React.PointerEvent, id?: string) => {
    if (!id) return;
    e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = p.screens.find((x) => x.id === id);
    if (!s) return;
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: s ? s.x : view.x, oy: s ? s.y : view.y, moved: false };
    if (id) onSelect(id);
  };
  const scale = () => { const r = svgRef.current?.getBoundingClientRect(); return r?.width ? vw / r.width / view.k : 0; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const { x: dx, y: dy } = sceneDrag((e.clientX - d.sx) * scale(), (e.clientY - d.sy) * scale(), projection);
    d.moved = true;
    if (d.id) setLive({ id: d.id, x: sn(d.ox + dx), y: sn(d.oy + dy) });
    else setView((v) => ({ ...v, x: d.ox - dx, y: d.oy - dy }));
  };
  const onUp = () => {
    const d = drag.current; drag.current = null;
    if (d?.id && live) { const L = live; mod(d.id, (s) => { s.x = L.x; s.y = L.y; }); }
    setLive(null);
  };
  const zoom = (f: number) => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, f);
  };
  const fit = () => {
    const bounds = sceneBounds(scene);
    const k = Math.max(0.005, Math.min(1, Math.min(vw / Math.max(1, bounds.w), vh / Math.max(1, bounds.h)) * 0.78));
    const x = bounds.x - (vw / k - bounds.w) / 2, y = bounds.y - (vh / k - bounds.h) / 2;
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity.translate(-x * k, -y * k).scale(k));
  };
  useEffect(fit, [p.screens.length, projection]);

  const align = (mode: "left" | "top" | "distH") => update((pr) => {
    const ss = pr.screens;
    if (mode === "left") { const m = Math.min(...ss.map((s) => s.x)); ss.forEach((s) => (s.x = m)); }
    if (mode === "top") { const m = Math.min(...ss.map((s) => s.y)); ss.forEach((s) => (s.y = m)); }
    if (mode === "distH") {
      const sorted = [...ss].sort((a, b) => a.x - b.x);
      const widths = sorted.map((s) => screenStats(s, lookup).widthMm);
      const first = sorted[0], lastI = sorted.length - 1, last = sorted[lastI];
      if (!first || !last) return pr;
      const span = last.x + (widths[lastI] ?? 0) - first.x;
      const gap = (span - widths.reduce((a, b) => a + b, 0)) / Math.max(1, lastI);
      let x = first.x; sorted.forEach((s, i) => { s.x = Math.round(x); x += (widths[i] ?? 0) + gap; });
    }
    return pr;
  });

  const addScreen = (kind: ScreenKind) => {
    const pnl = lookup("r500-p39");
    if (!pnl) return;
    const dims: Record<ScreenKind, [number, number]> = { principal: [8, 5], lateral: [4, 6], totem: [2, 6], banner: [16, 1], cabina: [6, 2], arco: [12, 4], libre: [4, 4] };
    const [c, r] = dims[kind];
    const s = newScreen(pnl, KINDS.find((k) => k.id === kind)?.label ?? "Pantalla", c, r);
    s.kind = kind;
    const maxX = Math.max(0, ...p.screens.map((x) => x.x + screenStats(x, lookup).widthMm));
    s.x = maxX + 1000;
    if (kind === "arco") s.geometry.type = "arco";
    update((pr) => { pr.screens.push(s); return pr; });
    onSelect(s.id);
  };

  const gridStep = snap > 0 ? Math.max(snap, 500) : 500;
  const gx0 = Math.floor(view.x / gridStep) * gridStep, gy0 = Math.floor(view.y / gridStep) * gridStep;
  const gxs: number[] = [], gys: number[] = [];
  if (showGrid) {
    for (let x = gx0; x < view.x + vw / view.k && gxs.length < 400; x += gridStep) gxs.push(x);
    for (let y = gy0; y < view.y + vh / view.k && gys.length < 400; y += gridStep) gys.push(y);
  }
  const fs = 12 / view.k;

  return (
    <Card title="Editor de escena (2D)" actions={
      <div className="flex flex-wrap items-center gap-1">
        <Btn variant="outline" className="h-8 px-2" title="Deshacer (Ctrl+Z)" disabled={!st.past.length} onClick={undo}><Undo2 size={16} /> <span className="hidden sm:inline">Deshacer</span></Btn>
        <Btn variant="outline" className="h-8 px-2" title="Rehacer (Ctrl+Y)" disabled={!st.future.length} onClick={redo}><Redo2 size={16} /> <span className="hidden sm:inline">Rehacer</span></Btn>
        <Btn variant="ghost" className="h-8 px-2" onClick={() => zoom(1.25)} title="Acercar"><ZoomIn size={16} /></Btn>
        <Btn variant="ghost" className="h-8 px-2" onClick={() => zoom(0.8)} title="Alejar"><ZoomOut size={16} /></Btn>
        <Btn variant="ghost" className="h-8 px-2 text-xs" onClick={fit}>Encuadrar</Btn>
      </div>}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Vista del plano 2D">
          {([['espacial', 'Espacial'], ['frontal', 'Frontal'], ['desarrollada', 'Desarrollada']] as const).map(([id, label]) =>
            <Btn key={id} variant={projection === id ? "primary" : "outline"} className="h-8 px-2 text-xs" aria-pressed={projection === id} onClick={() => setProjection(id)}>{label}</Btn>)}
        </div>
        <label className="flex items-center gap-1">Grilla
          <select className="rounded border border-input bg-background px-1" value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
            <option value={0}>sin ajuste</option><option value={10}>10 mm</option><option value={100}>100 mm</option><option value={250}>250 mm</option><option value={500}>500 mm</option>
          </select></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />Ver grilla</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />Etiquetas</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} />Cotas</label>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${vw} ${vh}`} aria-label="Editor de escena 2D" className="aspect-[1000/560] w-full touch-none rounded-md border border-border bg-muted cursor-grab active:cursor-grabbing"
        onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <g transform={`scale(${view.k}) translate(${-view.x} ${-view.y})`}>
          {gxs.map((x) => <line key={"x" + x} x1={x} y1={view.y} x2={x} y2={view.y + vh / view.k} stroke="currentColor" className="text-border" strokeWidth={1 / view.k} />)}
          {gys.map((y) => <line key={"y" + y} x1={view.x} y1={y} x2={view.x + vw / view.k} y2={y} stroke="currentColor" className="text-border" strokeWidth={1 / view.k} />)}
          <path d={`M${-fs * 2} 0H${fs * 2}M0 ${-fs * 2}V${fs * 2}`} stroke="currentColor" className="text-muted-foreground" strokeWidth={2 / view.k} />
          {p.screens.map((s, i) => {
            const t = screenStats(s, lookup);
            const pos = live?.id === s.id ? live : s;
            const cabinets = scene.filter((c) => c.screenId === s.id);
            const bounds = sceneBounds(cabinets);
            const offset = sceneOffset(pos.x - s.x, pos.y - s.y, projection);
            return (
              <g key={s.id} data-screen={s.id} onPointerDown={(e) => onDown(e, s.id)} className="cursor-move" transform={`translate(${offset.x} ${offset.y})`}>
                {cabinets.map((c) => <g key={c.id} data-cabinet={c.id}>
                  {c.faces.map((face, j) => <polygon key={j} points={face.map((q) => `${q.x},${q.y}`).join(' ')}
                    className={`${SCREEN_FILLS[i % SCREEN_FILLS.length]} ${s.id === selected ? "stroke-accent" : "stroke-foreground"}`}
                    fillOpacity={0.9} strokeWidth={(s.id === selected ? 1.5 : 0.8) / view.k} />)}
                </g>)}
                {showLabels && <text x={bounds.x + bounds.w / 2} y={bounds.y - fs * 1.7} fontSize={fs} className="fill-foreground" textAnchor="middle" fontWeight={700} pointerEvents="none">{s.name}</text>}
                {showDims && <text x={bounds.x + bounds.w / 2} y={bounds.y - fs * 0.4} textAnchor="middle" fontSize={fs * 0.8} fill="currentColor" className="text-foreground" pointerEvents="none">{fmtM(t.widthMm)} × {fmtM(t.heightMm)}</text>}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <select className={inputCls + " w-auto"} value="" onChange={(e) => e.target.value && addScreen(e.target.value as ScreenKind)}>
          <option value="">+ Agregar pantalla…</option>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <Btn variant="outline" onClick={() => align("left")}>Alinear izq.</Btn>
        <Btn variant="outline" onClick={() => align("top")}>Alinear arriba</Btn>
        <Btn variant="outline" onClick={() => align("distH")} disabled={p.screens.length < 3}>Distribuir H</Btn>
      </div>
      {sel && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted p-2 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]">
          <Field label="Nombre" className="col-span-2 sm:col-span-1"><input className={inputCls} value={sel.name} onChange={(e) => mod(sel.id, (s) => { s.name = e.target.value; })} /></Field>
          <Field label="Tipo"><select className={inputCls} value={sel.kind} onChange={(e) => mod(sel.id, (s) => { s.kind = e.target.value as ScreenKind; })}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></Field>
          <Field label="X mm"><Num value={sel.x} onChange={(v) => mod(sel.id, (s) => { s.x = Math.round(v ?? 0); })} /></Field>
          <Field label="Y mm"><Num value={sel.y} onChange={(v) => mod(sel.id, (s) => { s.y = Math.round(v ?? 0); })} /></Field>
          <div className="col-span-2 flex items-end gap-1 sm:col-span-1">
            <Btn variant="outline" title="Duplicar" onClick={() => { const c = structuredClone(sel); c.id = uid(); c.name += " (copia)"; c.x += 1000; c.cabinets.forEach((k) => (k.id = uid())); update((pr) => { pr.screens.push(c); return pr; }); onSelect(c.id); }}><Plus size={14} /><Copy size={14} /></Btn>
            <Btn variant="danger" title="Eliminar" disabled={p.screens.length < 2} onClick={() => { const next = p.screens.find((x) => x.id !== sel.id); if (!next) return; update((pr) => { pr.screens = pr.screens.filter((x) => x.id !== sel.id); return pr; }); onSelect(next.id); }}><Trash2 size={14} /></Btn>
          </div>
        </div>
      )}
    </Card>
  );
}
