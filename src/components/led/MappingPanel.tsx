import { useState } from "react";
import { screenStats } from "@/lib/led/engine";
import { exportCsv, exportSlicesJson, download } from "@/lib/led/exporters";
import { mappingWarnings, normDeg, rotateSlices, slicesByCabinet, slicesByScreen } from "@/lib/led/mapping";
import { uid, type Rect } from "@/lib/led/model";
import { analyzeTemplate, ARENA_TARGET, exportArenaXml, generateArenaXml, type TemplateInfo } from "@/lib/led/resolume";
import { allPanels, update, useStore } from "@/lib/led/store";
import { Btn, Card, Field, inputCls, Notice, Num } from "./ui";

const PRESETS = [{ l: "1920 × 1080", w: 1920, h: 1080 }, { l: "3840 × 2160", w: 3840, h: 2160 }];

export function MappingPanel() {
  const st = useStore();
  const p = st.project, m = p.mapping;
  const panels = allPanels(st);
  const lookup = (id: string) => panels.find((x) => x.id === id);
  const [tpl, setTpl] = useState<TemplateInfo | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [deg, setDeg] = useState<number | undefined>(5);
  const spin = (ids: Set<string>, d: number) => d && update((pr) => { pr.mapping.slices = rotateSlices(pr.mapping.slices, ids, d); return pr; });
  const warns = mappingWarnings(p);
  const total = p.screens.reduce((a, s) => a + screenStats(s, lookup).resX, 0);
  const maxH = Math.max(...p.screens.map((s) => screenStats(s, lookup).resY));

  const setRect = (i: number, k: "input" | "output", f: keyof Rect, v: number | undefined) =>
    update((pr) => { pr.mapping.slices[i]![k][f] = Math.round(v ?? 0); return pr; });

  return (
    <div className="space-y-3">
      <Card title="Canvas y salidas (píxeles)">
        <p className="mb-2 text-xs text-muted-foreground">Plano físico (mm) ≠ canvas de contenido (px) ≠ mapa de salida (px). Las separaciones físicas no se convierten en píxeles automáticamente. Curvas y cilindros usan el canvas rectangular desarrollado. Coordenadas enteras, origen arriba-izquierda, x→derecha, y→abajo.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Canvas W"><Num value={m.canvasW} onChange={(v) => update((pr) => { pr.mapping.canvasW = Math.round(v ?? 0); return pr; })} /></Field>
          <Field label="Canvas H"><Num value={m.canvasH} onChange={(v) => update((pr) => { pr.mapping.canvasH = Math.round(v ?? 0); return pr; })} /></Field>
          <Field label="Preset canvas"><select className={inputCls} value="" onChange={(e) => { const x = PRESETS[Number(e.target.value)]; if (x) update((pr) => { pr.mapping.canvasW = x.w; pr.mapping.canvasH = x.h; return pr; }); }}><option value="">Custom</option>{PRESETS.map((x, i) => <option key={i} value={i}>{x.l}</option>)}</select></Field>
          <div className="flex items-end"><Btn variant="outline" className="w-full" onClick={() => update((pr) => { pr.mapping.canvasW = total; pr.mapping.canvasH = maxH; return pr; })}>Ajustar al contenido 1:1</Btn></div>
        </div>
        <div className="mt-3 space-y-2">
          {m.outputs.map((o, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_80px_80px_auto] gap-2">
              <input className={inputCls} value={o.name} onChange={(e) => update((pr) => { pr.mapping.outputs[i]!.name = e.target.value; return pr; })} />
              <Num value={o.w} onChange={(v) => update((pr) => { pr.mapping.outputs[i]!.w = Math.round(v ?? 0); return pr; })} />
              <Num value={o.h} onChange={(v) => update((pr) => { pr.mapping.outputs[i]!.h = Math.round(v ?? 0); return pr; })} />
              <Btn variant="ghost" disabled={m.outputs.length < 2} onClick={() => update((pr) => { pr.mapping.outputs.splice(i, 1); return pr; })}>✕</Btn>
            </div>
          ))}
          <Btn variant="outline" onClick={() => update((pr) => { pr.mapping.outputs.push({ name: `Salida ${pr.mapping.outputs.length + 1}`, w: 1920, h: 1080 }); return pr; })}>+ Salida</Btn>
        </div>
      </Card>

      <Card title="Slices" actions={
        <div className="flex flex-wrap gap-1">
          <Btn variant="outline" className="h-8 text-xs" onClick={() => update((pr) => { pr.mapping.slices = slicesByScreen(pr, lookup); return pr; })}>Por pantalla</Btn>
          <Btn variant="outline" className="h-8 text-xs" onClick={() => update((pr) => { pr.mapping.slices = slicesByCabinet(pr, lookup); return pr; })}>Por gabinete</Btn>
          <Btn variant="outline" className="h-8 text-xs" onClick={() => update((pr) => { pr.mapping.slices.push({ id: uid(), name: `Grupo ${pr.mapping.slices.length + 1}`, input: { x: 0, y: 0, w: 256, h: 256 }, output: { x: 0, y: 0, w: 256, h: 256 }, outputIndex: 0 }); return pr; })}>+ Grupo</Btn>
        </div>}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-md bg-muted p-1.5 text-xs">
          <span className="font-bold text-muted-foreground">Girar {pick.size ? (pick.size === 1 ? "slice" : `grupo (${pick.size})`) : "— marcá slices"}:</span>
          <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size} title="Girar 1° antihorario" onClick={() => spin(pick, -1)}>↺ 1°</Btn>
          <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size} title="Girar 1° horario" onClick={() => spin(pick, 1)}>↻ 1°</Btn>
          <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size} onClick={() => spin(pick, -5)}>↺ 5°</Btn>
          <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size} onClick={() => spin(pick, 5)}>↻ 5°</Btn>
          <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size} onClick={() => spin(pick, 90)}>↻ 90°</Btn>
          <span className="flex items-center gap-1"><Num className="h-7 w-20" value={deg} onChange={setDeg} step={0.5} />°
            <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size || !deg} onClick={() => spin(pick, deg ?? 0)}>Aplicar</Btn></span>
          <Btn variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => setPick(pick.size === m.slices.length ? new Set() : new Set(m.slices.map((x) => x.id)))}>{pick.size === m.slices.length && m.slices.length ? "Ninguno" : "Todos"}</Btn>
          <p className="w-full text-muted-foreground">Un slice gira sobre su centro; un grupo gira alrededor de su centro común. También podés escribir el ángulo exacto en la columna Rot.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead><tr className="text-left text-muted-foreground"><th /><th className="p-1">Nombre</th><th>in X</th><th>in Y</th><th>in W</th><th>in H</th><th>Salida</th><th>out X</th><th>out Y</th><th>out W</th><th>out H</th><th>Rot.</th><th /></tr></thead>
            <tbody>
              {m.slices.map((s, i) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-0.5"><input type="checkbox" aria-label={`Seleccionar ${s.name}`} checked={pick.has(s.id)} onChange={() => setPick((prev) => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} /></td>
                  <td className="p-1"><input className={inputCls + " h-7"} value={s.name} onChange={(e) => update((pr) => { pr.mapping.slices[i]!.name = e.target.value; return pr; })} /></td>
                  {(["x", "y", "w", "h"] as const).map((f) => <td key={"i" + f} className="p-0.5"><Num className="h-7 w-16" value={s.input[f]} onChange={(v) => setRect(i, "input", f, v)} /></td>)}
                  <td className="p-0.5"><select className={inputCls + " h-7"} value={s.outputIndex} onChange={(e) => update((pr) => { pr.mapping.slices[i]!.outputIndex = Number(e.target.value); return pr; })}>{m.outputs.map((o, j) => <option key={j} value={j}>{o.name}</option>)}</select></td>
                  {(["x", "y", "w", "h"] as const).map((f) => <td key={"o" + f} className="p-0.5"><Num className="h-7 w-16" value={s.output[f]} onChange={(v) => setRect(i, "output", f, v)} /></td>)}
                  <td className="p-0.5"><Num className="h-7 w-16" step={0.5} value={s.rotation ?? 0} onChange={(v) => update((pr) => { pr.mapping.slices[i]!.rotation = normDeg(v ?? 0); return pr; })} /></td>
                  <td><Btn variant="ghost" className="h-7 px-2" onClick={() => update((pr) => { pr.mapping.slices.splice(i, 1); return pr; })}>✕</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!m.slices.length && <p className="p-2 text-xs text-muted-foreground">Generá slices por pantalla o por gabinete.</p>}
        </div>
        <div className="mt-2 space-y-1">{warns.slice(0, 12).map((w) => <Notice key={w}>{w}</Notice>)}{warns.length > 12 && <Notice>+{warns.length - 12} avisos más.</Notice>}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="outline" onClick={() => exportCsv(p)}>Descargar CSV</Btn>
          <Btn variant="outline" onClick={() => exportSlicesJson(p)}>Descargar JSON de slices</Btn>
        </div>
      </Card>

      <Card title="Resolume Arena — Advanced Output">
        <p className="text-xs text-muted-foreground">Genera el preset de Advanced Output con una pantalla por salida y tus slices (entrada, salida y rotación). Para cargarlo: copialo en Documentos/Resolume Arena/Presets/Advanced Output y elegilo en Output › Advanced Output. Las salidas a monitores físicos se reasignan en cada computadora.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-bold">Exportación directa</p>
            <p className="mt-1 text-xs text-muted-foreground">Formato de {ARENA_TARGET}. No verificado abriéndolo en Arena: probalo antes del show.</p>
            <Btn className="mt-2 w-full" disabled={!m.slices.length} onClick={() => download(`${p.name}_arena.xml`, generateArenaXml(p), "application/xml")}>Exportar XML para Arena</Btn>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-bold">Con preset real (más seguro)</p>
            <p className="mt-1 text-xs text-muted-foreground">Importá un preset guardado desde tu Arena; se usa como base conservando su estructura. El original no se modifica.</p>
            <label className="mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
              {tpl?.ok ? "Cambiar preset" : "Importar preset XML de Arena"}
              <input type="file" accept=".xml" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setTpl(analyzeTemplate(await f.text())); e.target.value = ""; }} />
            </label>
            {tpl?.ok && <Btn variant="outline" className="mt-2 w-full" disabled={!m.slices.length} onClick={() => download(`${p.name}_arena_preset.xml`, exportArenaXml(tpl, p), "application/xml")}>Exportar usando el preset</Btn>}
          </div>
        </div>
        {!m.slices.length && <p className="mt-2 text-xs text-muted-foreground">Primero generá slices (por pantalla o por gabinete).</p>}
        {tpl && (
          <div className="mt-2 space-y-1 text-xs">
            {tpl.ok && <Notice kind="info">Preset reconocido: raíz &lt;{tpl.rootName}&gt; · versión {tpl.version ?? "no declarada"} · {tpl.sliceCount} slice(s). Validación automática de estructura únicamente.</Notice>}
            {tpl.errors.map((x) => <Notice key={x} kind="error">{x}</Notice>)}
            {tpl.notes.map((x) => <Notice key={x}>{x}</Notice>)}
          </div>
        )}
      </Card>
    </div>
  );
}
