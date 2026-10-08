import { cableRuns, MAX_PIXELS_PER_CABLE, CABLING_NOTE } from "@/lib/led/cabling";
import type { NumberOrder, Corner, Screen } from "@/lib/led/model";
import { portColor, wiringPlan } from "@/lib/led/plan";
import { allPanels, update, useStore } from "@/lib/led/store";
import { PlanView } from "./PlanView";
import { Card, Notice } from "./ui";

export function WiringPanel({ screen, dark }: { screen: Screen; dark: boolean }) {
  const st = useStore();
  const panels = allPanels(st);
  const lookup = (id: string) => panels.find((p) => p.id === id);
  const idx = st.project.screens.findIndex((s) => s.id === screen.id);
  const { runs, errors } = cableRuns(screen, lookup);
  const plan = wiringPlan(screen, lookup, { dims: false, numbers: true, ink: dark ? "#E8F1FA" : "#0B1B2B", muted: "#6b7c8f" }, idx);
  const mod = (fn: (s: Screen) => void) => update((p) => { const s = p.screens.find((x) => x.id === screen.id); if (s) fn(s); return p; });

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card title={`Puertos de datos · ${screen.name}`}>
        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1 font-semibold">Recorrido
            <select className="h-8 rounded border border-input bg-background px-1" value={screen.numbering.order} onChange={(e) => mod((s) => { s.numbering.order = e.target.value as NumberOrder; })}>
              <option value="filas">Por filas</option><option value="columnas">Por columnas</option><option value="serpentina">Serpentina</option>
            </select></label>
          <label className="flex flex-col gap-1 font-semibold">Inicio
            <select className="h-8 rounded border border-input bg-background px-1" value={screen.numbering.start} onChange={(e) => mod((s) => { s.numbering.start = e.target.value as Corner; })}>
              <option value="tl">↖ Arriba izq.</option><option value="tr">↗ Arriba der.</option><option value="bl">↙ Abajo izq.</option><option value="br">↘ Abajo der.</option>
            </select></label>
        </div>
        {errors.map((e) => <Notice key={e} kind="error">{e}</Notice>)}
        <ul className="space-y-1.5">
          {runs.map((r) => (
            <li key={r.port} className="rounded-md border border-border p-2 text-xs">
              <div className="flex items-center gap-2 font-bold">
                <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: portColor(r.port) }} />
                Puerto {r.port} <span className="ml-auto font-normal text-muted-foreground">{r.cabinets.length} gab.</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full" style={{ width: `${(r.pixels / MAX_PIXELS_PER_CABLE) * 100}%`, background: portColor(r.port) }} /></div>
              <div className="mt-0.5 text-muted-foreground">{r.pixels.toLocaleString("es-AR")} / 650.000 px</div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">{CABLING_NOTE}</p>
      </Card>
      <Card title="Pixel Plot">
        <PlanView plan={plan} className="h-auto max-h-[70vh] w-full" />
      </Card>
    </div>
  );
}
