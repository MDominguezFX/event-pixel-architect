import { useState } from "react";
import { cableRuns, MAX_PIXELS_PER_CABLE, CABLING_NOTE, CORNER_LABEL } from "@/lib/led/cabling";
import { cabDims } from "@/lib/led/engine";
import type { Corner, Screen } from "@/lib/led/model";
import { portColor, wiringPlan } from "@/lib/led/plan";
import { allPanels, update, useStore } from "@/lib/led/store";
import { PlanView } from "./PlanView";
import { Btn, Card, Notice } from "./ui";

export function WiringPanel({ screen, dark }: { screen: Screen; dark: boolean }) {
  const st = useStore();
  const panels = allPanels(st);
  const lookup = (id: string) => panels.find((p) => p.id === id);
  const idx = st.project.screens.findIndex((s) => s.id === screen.id);
  const { runs, errors, warnings, route, manual } = cableRuns(screen, lookup);
  const plan = wiringPlan(screen, lookup, { dims: false, numbers: true, ink: dark ? "#E8F1FA" : "#0B1B2B", muted: "#6b7c8f" }, idx);
  const mod = (fn: (s: Screen) => void) => update((p) => { const s = p.screens.find((x) => x.id === screen.id); if (s) fn(s); return p; });

  const [draft, setDraft] = useState<string[]>([]);
  const box = (id: string) => {
    const c = screen.cabinets.find((k) => k.id === id);
    const pn = c && lookup(c.panelId);
    if (!c || !pn) return null;
    const d = cabDims(c, pn);
    return { x: c.x, y: c.y, w: d.w, h: d.h };
  };
  const onPlanClick = (x: number, y: number) => {
    const hit = screen.cabinets.find((k) => { const b = box(k.id)!; return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; });
    if (!hit) return;
    setDraft((prev) => prev.includes(hit.id) ? prev.filter((id) => id !== hit.id) : [...prev, hit.id]);
  };
  const closePort = () => {
    if (!draft.length) return;
    mod((s) => { s.manualRuns = [...(s.manualRuns ?? []), ...[draft]]; });
    setDraft([]);
  };
  const draftPrims = draft.map((id) => { const b = box(id)!; return { t: "rect" as const, x: b.x, y: b.y, w: b.w, h: b.h, stroke: "#F5A524", lw: Math.min(b.w, b.h) * 0.06 }; });

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card title={`Puertos de datos · ${screen.name}`}>
        <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1 text-xs font-bold">
          <button className={`flex-1 rounded-md py-1.5 ${!manual ? "bg-card shadow" : ""}`} onClick={() => mod((s) => { delete s.manualRuns; })}>Automático</button>
          <button className={`flex-1 rounded-md py-1.5 ${manual ? "bg-card shadow" : ""}`} onClick={() => mod((s) => { if (!s.manualRuns?.length) s.manualRuns = [[]]; })}>Manual</button>
        </div>
        {!manual && (
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-1 font-semibold">Recorrido
              <span className="flex h-8 items-center rounded border border-input bg-muted px-2 font-normal">Serpentina (fijo)</span></div>
            <label className="flex flex-col gap-1 font-semibold">Inicio
              <select className="h-8 rounded border border-input bg-background px-1" value={screen.numbering.start} onChange={(e) => mod((s) => { s.numbering.start = e.target.value as Corner; })}>
                <option value="tl">↖ Arriba izq.</option><option value="tr">↗ Arriba der.</option><option value="bl">↙ Abajo izq.</option><option value="br">↘ Abajo der.</option>
              </select></label>
          </div>
        )}
        {!manual && <p className="mb-2 rounded-md bg-muted p-2 text-xs"><b>Recorrido óptimo:</b> serpentina por {route.axis}, desde {CORNER_LABEL[route.start]} · {runs.length} puerto{runs.length === 1 ? "" : "s"} (mínimo posible: {Math.max(1, Math.ceil(runs.reduce((a, r) => a + r.pixels, 0) / MAX_PIXELS_PER_CABLE))})</p>}
        {manual && (
          <div className="mb-2 space-y-1.5 rounded-md bg-muted p-2 text-xs">
            <p><b>Cableado manual:</b> hacé clic en los gabinetes del plano en el orden de conexión. Cuando termines un cable, tocá «Cerrar puerto» y empezá el siguiente.</p>
            <div className="flex flex-wrap gap-1">
              <Btn className="h-7 px-2 text-xs" disabled={!draft.length} onClick={closePort}>Cerrar puerto ({draft.length} gab.)</Btn>
              <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!draft.length} onClick={() => setDraft((d) => d.slice(0, -1))}>Deshacer último</Btn>
              <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!screen.manualRuns?.some((r) => r.length)} onClick={() => mod((s) => { s.manualRuns = (s.manualRuns ?? []).slice(0, -1); })}>Quitar último puerto</Btn>
              <Btn variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => { mod((s) => { delete s.manualRuns; }); setDraft([]); }}>Borrar todo</Btn>
            </div>
          </div>
        )}
        {errors.map((e) => <Notice key={e} kind="error">{e}</Notice>)}
        {warnings.map((e) => <Notice key={e}>{e}</Notice>)}
        <ul className="space-y-1.5">
          {runs.map((r) => (
            <li key={r.port} className="rounded-md border border-border p-2 text-xs">
              <div className="flex items-center gap-2 font-bold">
                <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: portColor(r.port) }} />
                Puerto {r.port} <span className="ml-auto font-normal text-muted-foreground">{r.cabinets.length} gab.</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full" style={{ width: `${Math.min(100, (r.pixels / MAX_PIXELS_PER_CABLE) * 100)}%`, background: portColor(r.port) }} /></div>
              <div className="mt-0.5 text-muted-foreground">{r.pixels.toLocaleString("es-AR")} / 650.000 px</div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">{CABLING_NOTE}</p>
      </Card>
      <Card title="Pixel Plot">
        <PlanView plan={draftPrims.length ? { ...plan, prims: [...plan.prims, ...draftPrims] } : plan} className="h-auto max-h-[70vh] w-full" onCabinetClick={manual ? onPlanClick : undefined} />
      </Card>
    </div>
  );
}
