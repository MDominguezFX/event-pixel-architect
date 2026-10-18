import { useMemo, useState } from "react";
import { CATEGORIES, realPitch, type Panel } from "@/lib/led/catalog";
import { fmtM, fmtN, gridColsRows, near169, screenStats, suggestSizes } from "@/lib/led/engine";
import { computeCurve } from "@/lib/led/geometry";
import { buildMix, mergeSmall, mixCompat, mixOptions, splitLarge, type MixGoal } from "@/lib/led/mix";
import { uid, uniformCabinets, type Cabinet, type GeometryType, type Screen } from "@/lib/led/model";
import { frontPlan, topPlan, wiringPlan } from "@/lib/led/plan";
import { cableRuns } from "@/lib/led/cabling";
import { allPanels, update, useStore } from "@/lib/led/store";
import { cabDims } from "@/lib/led/engine";
import { rotateFree, rotateGroup } from "@/lib/led/edit";
import { PlanView } from "./PlanView";
import { Btn, Card, Field, inputCls, Notice, Num, Stat } from "./ui";
import { ScreenRotation } from "./ScreenRotation";
import { sceneHeight } from "@/lib/led/scene3d";

export function ScreenConfig({ screen, onNewPanel, dark }: { screen: Screen; onNewPanel: () => void; dark: boolean }) {
  const st0 = useStore();
  const panels = allPanels(st0);
  const lookup = (id: string) => panels.find((p) => p.id === id);
  const stats = screenStats(screen, lookup);
  const { cols, rows, first } = gridColsRows(screen, lookup);
  const panel = first ?? panels[0]!;
  const rotated = screen.cabinets[0]?.rotated ?? false;
  const isMix = stats.types.length > 1;
  const [inputMode, setInputMode] = useState<"grilla" | "metros">("grilla");
  const [wantW, setWantW] = useState(4);
  const [wantH, setWantH] = useState(2.5);
  const [showDims, setShowDims] = useState(true);
  const [showNums, setShowNums] = useState(true);
  const [showWiring, setShowWiring] = useState(false);
  // mezcla
  const [smallId, setSmallId] = useState("r500-p39");
  const [largeId, setLargeId] = useState("r1000-p39");
  const [goal, setGoal] = useState<MixGoal>("menos");
  const [stockS, setStockS] = useState<number | undefined>();
  const [stockL, setStockL] = useState<number | undefined>();
  const [tool, setTool] = useState<"intercambiar" | "agregar" | "quitar" | "girar">("agregar");
  const [addPanelId, setAddPanelId] = useState("");
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [manualDeg, setManualDeg] = useState<number | undefined>(5);
  const spin = (delta: number) => { if (!pick.size || !delta) return; setEditMsg(null); mod((s) => { s.cabinets = rotateFree(s.cabinets, pick, delta, lookup); }); };
  const rotatePick = (ids: Set<string>) => {
    const next = rotateGroup(screen.cabinets, ids, lookup);
    if (!next) return setEditMsg("Girado se superpone con otros gabinetes: mové o quitá los que estorban, o elegí otro grupo.");
    setEditMsg(null); mod((s) => { s.cabinets = next; });
  };
  const [band, setBand] = useState<"arriba" | "abajo">("arriba");

  const mod = (fn: (s: Screen) => void) => update((p) => { const s = p.screens.find((x) => x.id === screen.id)!; fn(s); return p; });
  const setGrid = (c: number, r: number, pnl = panel, rot = rotated) => mod((s) => { s.cabinets = uniformCabinets(pnl, Math.max(1, Math.round(c)), Math.max(1, Math.round(r)), rot); });

  const ink = dark ? "#E8F1FA" : "#0B1B2B";
  const po = { dims: showDims, numbers: showNums, ink, muted: "#6b7c8f" };
  const fp = useMemo(() => frontPlan(screen, lookup, po), [screen, panels.length, showDims, showNums, dark]);
  const tp = useMemo(() => topPlan(screen, lookup, po), [screen, panels.length, showDims, showNums, dark]);
  const wiring = cableRuns(screen, lookup);
  const wp = wiringPlan(screen, lookup, po, st0.project.screens.findIndex((s) => s.id === screen.id));
  const colW = screen.cabinets[0] ? cabDims(screen.cabinets[0], panel).w : panel.widthMm;
  const curve = computeCurve(screen.geometry, cols, colW, panel);

  const small = lookup(smallId), large = lookup(largeId);
  const compat = small && large ? mixCompat(small, large, screen.mixConfirmed) : { ok: false, reasons: ["Elegí ambos formatos."] };
  const mixInp = small && large ? { small, large, wantWmm: wantW * 1000, wantHmm: wantH * 1000, goal, stockSmall: stockS ?? null, stockLarge: stockL ?? null } : null;
  const opts = mixInp && compat.ok ? mixOptions(mixInp) : [];

  const grouped = CATEGORIES.map((c) => ({ ...c, items: panels.filter((p) => p.category === c.id) })).filter((g) => g.items.length);

  const box = (k: Cabinet) => { const pn = lookup(k.panelId); const d = pn ? cabDims(k, pn) : { w: 0, h: 0 }; return { x: k.x, y: k.y, w: d.w, h: d.h }; };
  const hits = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
  const normalize = (s: Screen) => { const mx = Math.min(...s.cabinets.map((c) => c.x)), my = Math.min(...s.cabinets.map((c) => c.y)); s.cabinets.forEach((c) => { c.x -= mx; c.y -= my; }); };
  const onPlanClick = (x: number, y: number) => {
    const c = screen.cabinets.find((k) => { const b = box(k); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; });
    if (tool === "agregar") {
      if (c) return setEditMsg("Ese lugar ya tiene un gabinete: hacé clic en un espacio vacío junto a la pantalla.");
      const pnl = lookup(addPanelId) ?? panel;
      const w = rotated ? pnl.heightMm : pnl.widthMm, h = rotated ? pnl.widthMm : pnl.heightMm;
      const nb = { x: Math.floor(x / w) * w, y: Math.floor(y / h) * h, w, h };
      if (screen.cabinets.some((k) => hits(box(k), nb))) return setEditMsg("No entra un gabinete completo en ese lugar sin superponerse.");
      setEditMsg(null);
      return mod((s) => { s.cabinets.push({ id: uid(), panelId: pnl.id, x: nb.x, y: nb.y, rotated }); normalize(s); });
    }
    if (!c) return;
    if (tool === "quitar") {
      if (screen.cabinets.length < 2) return setEditMsg("La pantalla necesita al menos un gabinete.");
      setEditMsg(null);
      return mod((s) => { s.cabinets = s.cabinets.filter((k) => k.id !== c.id); normalize(s); });
    }
    if (tool === "girar") {
      setEditMsg(null);
      return setPick((prev) => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; });
    }
    if (!isMix || !small || !large) return setEditMsg("Intercambiar formatos funciona en pantallas mixtas compatibles (ver Mezcla).");
    mod((s) => { s.cabinets = c.panelId === large.id ? splitLarge(s.cabinets, c.id, small) : mergeSmall(s.cabinets, c.id, small, large); });
  };
  const edge = (axis: "col" | "row", add: boolean) => mod((s) => {
    const bs = s.cabinets.map((k) => ({ k, b: box(k) }));
    const max = Math.max(...bs.map(({ b }) => (axis === "col" ? b.x + b.w : b.y + b.h)));
    const lastOnes = bs.filter(({ b }) => Math.abs((axis === "col" ? b.x + b.w : b.y + b.h) - max) < 0.5);
    if (add) lastOnes.forEach(({ k, b }) => s.cabinets.push({ ...k, id: uid(), x: axis === "col" ? b.x + b.w : b.x, y: axis === "row" ? b.y + b.h : b.y }));
    else if (lastOnes.length < s.cabinets.length) s.cabinets = s.cabinets.filter((k) => !lastOnes.some((l) => l.k.id === k.id));
  });

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <Card title="1 · Panel" actions={<Btn variant="outline" className="h-8 text-xs" onClick={onNewPanel}>+ Crear panel personalizado</Btn>}>
          <select className={inputCls} value={panel.id} onChange={(e) => { const p = lookup(e.target.value)!; setGrid(cols, rows, p, false); }}>
            {grouped.map((g) => <optgroup key={g.id} label={g.label}>{g.items.map((p) => <option key={p.id} value={p.id}>{p.name}{p.generic ? " (genérico)" : ""}</option>)}</optgroup>)}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            {panel.widthMm}×{panel.heightMm} mm · {panel.resX}×{panel.resY} px · pitch real {realPitch(panel).x.toFixed(3)} mm
            {panel.generic && " · Preset genérico editable, sin compatibilidad mecánica asumida."}
          </p>
          {panel.orientations.includes("horizontal") && (
            <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={rotated} onChange={(e) => setGrid(cols, rows, panel, e.target.checked)} /> Girar 90° (intercambia medidas y resolución)</label>
          )}
        </Card>

        <Card title="2 · Geometría">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <select className={inputCls} value={screen.geometry.type} onChange={(e) => mod((s) => { s.geometry.type = e.target.value as GeometryType; })}>
                <option value="plana">Plana</option><option value="concava">Cóncava</option><option value="convexa">Convexa</option><option value="arco">Arco parcial</option><option value="cilindro">Cilindro 360°</option>
              </select>
            </Field>
            {screen.geometry.type !== "plana" && (
              <Field label="Construcción">
                <select className={inputCls} value={screen.geometry.mode} onChange={(e) => mod((s) => { s.geometry.mode = e.target.value as "facetada" | "continua"; })}>
                  <option value="facetada">Rígida (facetada)</option><option value="continua">Flexible (continua)</option>
                </select>
              </Field>
            )}
            {screen.geometry.type !== "plana" && screen.geometry.type !== "cilindro" && (
              <>
                <Field label="Parámetro de entrada">
                  <select className={inputCls} value={screen.geometry.input} onChange={(e) => mod((s) => { s.geometry.input = e.target.value as never; })}>
                    {screen.geometry.mode === "facetada" ? <option value="angulo">Ángulo entre gabinetes</option> : <option value="radio">Radio</option>}
                    <option value="apertura">Apertura total</option>
                  </select>
                </Field>
                {screen.geometry.input === "apertura" ? (
                  <Field label="Apertura °"><Num value={screen.geometry.apertureDeg} onChange={(v) => mod((s) => { s.geometry.apertureDeg = v ?? 0; })} /></Field>
                ) : screen.geometry.mode === "facetada" ? (
                  <Field label="Ángulo °"><Num value={screen.geometry.angleDeg} step={0.5} onChange={(v) => mod((s) => { s.geometry.angleDeg = v ?? 0; })} /></Field>
                ) : (
                  <Field label="Radio mm"><Num value={screen.geometry.radiusMm} onChange={(v) => mod((s) => { s.geometry.radiusMm = v ?? 0; })} /></Field>
                )}
              </>
            )}
          </div>
          {screen.geometry.type !== "plana" && <div className="mt-2 space-y-1">{curve.errors.map((e) => <Notice key={e} kind="error">{e}</Notice>)}{curve.warnings.map((e) => <Notice key={e}>{e}</Notice>)}</div>}
        </Card>

        <Card title="3 · Tamaño">
          <div className="mb-2 flex gap-1 rounded-lg bg-muted p-1 text-xs font-bold">
            {(["grilla", "metros"] as const).map((m) => <button key={m} onClick={() => setInputMode(m)} className={`flex-1 rounded-md py-1.5 ${inputMode === m ? "bg-card shadow" : ""}`}>{m === "grilla" ? "Columnas × filas" : "Medidas en m"}</button>)}
          </div>
          {inputMode === "grilla" ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Columnas"><Num value={cols} min={1} onChange={(v) => v && setGrid(v, rows)} /></Field>
              <Field label="Filas"><Num value={rows} min={1} onChange={(v) => v && setGrid(cols, v)} /></Field>
              {isMix && <p className="col-span-2 text-xs text-muted-foreground">Pantalla mixta: al cambiar columnas/filas se reemplaza por un formato uniforme.</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Ancho deseado m"><Num value={wantW} step={0.1} onChange={(v) => setWantW(v ?? 0)} /></Field>
                <Field label="Alto deseado m"><Num value={wantH} step={0.1} onChange={(v) => setWantH(v ?? 0)} /></Field>
              </div>
              <div className="mt-2 space-y-1">
                {wantW > 0 && wantH > 0 && suggestSizes(panel, wantW * 1000, wantH * 1000, rotated).map((o) => (
                  <button key={o.label} onClick={() => setGrid(o.cols, o.rows)} className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-muted">
                    <span className="font-bold">{o.label}</span>
                    <span className="truncate">{o.cols}×{o.rows} → {fmtM(o.widthMm)} × {fmtM(o.heightMm)} ({o.dW >= 0 ? "+" : ""}{o.dW} / {o.dH >= 0 ? "+" : ""}{o.dH} mm)</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-bold text-secondary-foreground">Proporciones cercanas a 16:9</summary>
            <div className="mt-1 flex flex-wrap gap-1">{near169(panel).map((o) => <button key={`${o.cols}x${o.rows}`} className="rounded bg-muted px-2 py-1" onClick={() => setGrid(o.cols, o.rows)}>{o.cols}×{o.rows} ({o.errPct >= 0 ? "+" : ""}{o.errPct.toFixed(2)}%)</button>)}</div>
          </details>
        </Card>

        <Card title="Mezcla 500×500 + 500×1000">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Chico (celda)"><select className={inputCls} value={smallId} onChange={(e) => setSmallId(e.target.value)}>{panels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Grande (2 celdas)"><select className={inputCls} value={largeId} onChange={(e) => setLargeId(e.target.value)}>{panels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Ancho m"><Num value={wantW} step={0.5} onChange={(v) => setWantW(v ?? 0)} /></Field>
            <Field label="Alto m"><Num value={wantH} step={0.5} onChange={(v) => setWantH(v ?? 0)} /></Field>
            <Field label="Stock chicos"><Num value={stockS} min={0} onChange={setStockS} /></Field>
            <Field label="Stock grandes"><Num value={stockL} min={0} onChange={setStockL} /></Field>
            <Field label="Objetivo"><select className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value as MixGoal)}><option value="menos">Menos gabinetes</option><option value="stock">Aprovechar stock</option><option value="grandes">Priorizar 500×1000</option><option value="chicos">Priorizar 500×500</option></select></Field>
            <Field label="Banda chica"><select className={inputCls} value={band} onChange={(e) => setBand(e.target.value as "arriba" | "abajo")}><option value="arriba">Arriba</option><option value="abajo">Abajo</option></select></Field>
          </div>
          <label className="mt-2 flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={screen.mixConfirmed} onChange={(e) => mod((s) => { s.mixConfirmed = e.target.checked; })} />Confirmo que ambos formatos son de la misma familia con compatibilidad mecánica y de montaje verificada.</label>
          {!compat.ok && <div className="mt-2 space-y-1">{compat.reasons.map((r) => <Notice key={r}>{r}</Notice>)}</div>}
          <div className="mt-2 space-y-1.5">
            {opts.map((o) => (
              <div key={o.name} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2"><b>{o.name}</b>
                  <Btn className="h-7 text-xs" disabled={!o.feasible} onClick={() => mixInp && mod((s) => { s.cabinets = buildMix(mixInp, o, band); })}>Aplicar</Btn></div>
                <div>{o.large} grandes + {o.small} chicos = <b>{o.total}</b> · {fmtM(o.widthMm)} × {fmtM(o.heightMm)} · {o.resX}×{o.resY} px</div>
                <div className="text-muted-foreground">Dif.: {o.dW >= 0 ? "+" : ""}{o.dW} / {o.dH >= 0 ? "+" : ""}{o.dH} mm · {o.cols} col · {o.bands} bandas de 1 m + {o.rows - 2 * o.bands} de 0,5 m</div>
                {!o.feasible && <div className="font-bold text-destructive">Excede stock: faltan {o.shortage.large} grandes / {o.shortage.small} chicos</div>}
              </div>
            ))}
          </div>
          {isMix && <p className="mt-2 text-xs text-muted-foreground">Tocá un gabinete grande en el plano para dividirlo en dos chicos, o un chico para unirlo con el contiguo vertical.</p>}
        </Card>
      </div>

      <div className="order-first min-w-0 space-y-3 lg:order-none">
        <Card title="Resultados">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <Stat label={screen.geometry.type === "plana" ? "Ancho" : "Ancho desarrollado"} value={fmtM(stats.widthMm)} />
            <Stat label="Alto" value={fmtM(stats.heightMm)} />
            <Stat label="Gabinetes" value={stats.count} hint={stats.types.map((t) => `${t.count}× ${t.panel.widthMm}×${t.panel.heightMm}`).join(" + ")} />
            <Stat label="Superficie LED" value={`${stats.areaM2.toFixed(2)} m²`} hint={stats.covered ? "Sin huecos" : `Envolvente ${stats.envelopeM2.toFixed(2)} m²`} />
            <Stat label="Resolución" value={`${stats.resX} × ${stats.resY}`} />
            <Stat label="Píxeles totales" value={fmtN(stats.activePixels)} />
            <Stat label="Relación" value={stats.aspectLabel} hint={`${stats.diff169Pct >= 0 ? "+" : ""}${stats.diff169Pct.toFixed(2)}% vs 16:9`} />
            <Stat label="Peso / consumo" value={stats.weightKg == null ? "Sin datos" : `${stats.weightKg} kg`} hint={stats.powerMaxW == null ? "Consumo: sin datos" : `${stats.powerMaxW} W máx.`} />
            {screen.geometry.type !== "plana" && <>
              <Stat label="Apertura" value={`${curve.apertureDeg.toFixed(1)}°`} hint={curve.faceted ? `Giro ${curve.turnDeg.toFixed(2)}°` : "Continua"} />
              <Stat label="Radio" value={curve.radiusMm ? fmtM(curve.radiusMm) : "-"} hint={curve.faceted && curve.radiusVertexMm ? `a vértices ${fmtM(curve.radiusVertexMm)}` : curve.radiusRef} />
              <Stat label="Frente proyectado" value={fmtM(curve.frontWidthMm)} hint={`Cuerda ${fmtM(curve.chordMm)}`} />
              <Stat label="Profundidad" value={fmtM(curve.depthMm)} hint={curve.outerDiameterMm ? `Ø exterior ${fmtM(curve.outerDiameterMm)}` : undefined} />
            </>}
          </div>
          {stats.overlaps && <div className="mt-2"><Notice kind="error">Hay gabinetes superpuestos.</Notice></div>}
          {stats.mixedPitch && <div className="mt-2"><Notice>La pantalla mezcla pitches distintos.</Notice></div>}
        </Card>
        <Card title="Plano" actions={
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex gap-1" role="group" aria-label="Tipo de plano">
              <Btn className="h-7 px-2 text-xs" variant={!showWiring ? "default" : "outline"} onClick={() => setShowWiring(false)}>Gabinetes</Btn>
              <Btn className="h-7 px-2 text-xs" variant={showWiring ? "default" : "outline"} onClick={() => setShowWiring(true)}>Cableado</Btn>
            </div>
            <label className="flex items-center gap-1"><input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} />Cotas</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={showNums} onChange={(e) => setShowNums(e.target.checked)} />Numeración</label>
            <select className="rounded border border-input bg-background px-1" value={screen.numbering.order} onChange={(e) => mod((s) => { s.numbering.order = e.target.value as never; })}>
              <option value="filas">Por filas</option><option value="columnas">Por columnas</option><option value="serpentina">Serpentina</option>
            </select>
            <select className="rounded border border-input bg-background px-1" value={screen.numbering.start} onChange={(e) => mod((s) => { s.numbering.start = e.target.value as never; })}>
              <option value="tl">Inicio ↖</option><option value="tr">Inicio ↗</option><option value="bl">Inicio ↙</option><option value="br">Inicio ↘</option>
            </select>
          </div>}>
          {!showWiring && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-md bg-muted p-1.5 text-xs">
              <span className="font-bold text-muted-foreground">Editar en el plano:</span>
              {([["agregar", "＋ Agregar"], ["quitar", "− Quitar"], ["girar", "↻ Girar"], ["intercambiar", "⇄ Intercambiar"]] as const).map(([k, l]) => (
                <Btn key={k} className="h-7 px-2 text-xs" variant={tool === k ? "default" : "outline"} onClick={() => { setTool(k); setEditMsg(null); }}>{l}</Btn>
              ))}
              {tool === "girar" && <>
                <Btn className="h-7 px-2 text-xs" disabled={!pick.size} onClick={() => rotatePick(pick)}>↻ 90° {pick.size === 1 ? "panel" : `grupo (${pick.size})`}</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size} title="Girar 1° antihorario" onClick={() => spin(-1)}>↺ 1°</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size} title="Girar 1° horario" onClick={() => spin(1)}>↻ 1°</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size} title="Girar 5° antihorario" onClick={() => spin(-5)}>↺ 5°</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size} title="Girar 5° horario" onClick={() => spin(5)}>↻ 5°</Btn>
                <span className="flex items-center gap-1"><Num className="h-7 w-20" value={manualDeg} onChange={setManualDeg} step={0.5} />°
                  <Btn variant="outline" className="h-7 px-2 text-xs" disabled={!pick.size || !manualDeg} onClick={() => spin(manualDeg ?? 0)}>Aplicar</Btn></span>
                <Btn variant="ghost" className="h-7 px-2 text-xs" disabled={!pick.size || !screen.cabinets.some((k) => pick.has(k.id) && k.angleDeg)} title="Quitar giro libre" onClick={() => mod((s) => { s.cabinets.forEach((k) => { if (pick.has(k.id)) delete k.angleDeg; }); })}>0°</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" onClick={() => rotatePick(new Set(screen.cabinets.map((k) => k.id)))}>↻ Girar pantalla completa</Btn>
                <ScreenRotation screen={screen} onChange={(values) => mod((s) => { s.mountHeightM = sceneHeight(s, lookup); Object.assign(s, values); })} />
                <span className="flex items-center gap-1 rounded border border-input bg-background px-1.5" title="Altura libre de la base de la pantalla sobre el suelo (solo vistas 3D/espacial). Sirve para que las pantallas de techo no choquen con las de pared.">
                  <span className="font-bold text-muted-foreground">Altura</span>
                  <Num className="h-7 w-16" value={screen.mountHeightM} step={0.1} onChange={(v) => mod((s) => { if (v == null) delete s.mountHeightM; else s.mountHeightM = Math.max(0, v); })} />m
                </span>
                <Btn variant="outline" className="h-7 px-2 text-xs" onClick={() => setPick(new Set(screen.cabinets.map((k) => k.id)))}>Seleccionar todos</Btn>
                <Btn variant="ghost" className="h-7 px-2 text-xs" disabled={!pick.size} onClick={() => setPick(new Set())}>Limpiar</Btn>
              </>}
              {tool === "agregar" && <select className="h-7 max-w-[180px] rounded border border-input bg-background px-1" value={addPanelId || panel.id} onChange={(e) => setAddPanelId(e.target.value)}>
                {[...new Set([panel.id, ...stats.types.map((t) => t.panel.id), smallId, largeId])].map((id) => lookup(id)).filter((x): x is Panel => !!x).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>}
              <span className="ml-auto flex gap-1">
                <Btn variant="outline" className="h-7 px-2 text-xs" title="Agregar columna a la derecha" onClick={() => edge("col", true)}>+ Col</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" title="Quitar última columna" onClick={() => edge("col", false)}>− Col</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" title="Agregar fila abajo" onClick={() => edge("row", true)}>+ Fila</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" title="Quitar última fila" onClick={() => edge("row", false)}>− Fila</Btn>
              </span>
              <p className="w-full text-muted-foreground">{tool === "agregar" ? "Clic en un espacio vacío junto a la pantalla para sumar un gabinete." : tool === "quitar" ? "Clic en un gabinete para quitarlo." : tool === "girar" ? "Clic en uno o varios gabinetes para seleccionarlos (borde naranja) y después Girar: un panel gira en su lugar, un grupo gira como bloque. 90° cambia la orientación real; ↺/↻ 5° o grados a mano son giros parciales de esquema (no cambian píxeles ni validan montaje)." : "Clic en un gabinete grande para dividirlo en dos chicos, o en uno chico para unirlo."}</p>
            </div>
          )}
          {editMsg && !showWiring && <div className="mb-2"><Notice>{editMsg}</Notice></div>}
          {showWiring && wiring.errors.map((e) => <Notice key={e} kind="error">{e}</Notice>)}
          <PlanView plan={showWiring ? wp : tool === "girar" && pick.size ? { ...fp, prims: [...fp.prims, ...screen.cabinets.filter((k) => pick.has(k.id)).map((k) => { const b = box(k); return { t: "rect" as const, x: b.x, y: b.y, w: b.w, h: b.h, stroke: "#F5A524", lw: Math.min(b.w, b.h) * 0.06, rot: k.angleDeg || undefined }; })] } : fp} className="h-auto max-h-[60vh] w-full" onCabinetClick={showWiring ? undefined : onPlanClick} />
          {tp && !showWiring && <div className="mt-4 border-t border-border pt-3"><p className="mb-1 text-xs font-bold text-muted-foreground">Vista superior (esquema)</p><PlanView plan={tp} className="h-auto max-h-[45vh] w-full" /></div>}
        </Card>
      </div>
    </div>
  );
}

export type { Panel };
