import { t, translateValue, useLocale } from "@/lib/i18n/react";
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
  useLocale();
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
        <Card title={t("1 · Panel")} actions={<Btn variant="outline" className="h-8 text-xs" onClick={translateValue(onNewPanel)}>{t("+ Crear panel personalizado")}</Btn>}>
          <select className={translateValue(inputCls)} value={translateValue(panel.id)} onChange={(e) => { const p = lookup(e.target.value)!; setGrid(cols, rows, p, false); }}>
            {grouped.map((g) => <optgroup key={translateValue(g.id)} label={translateValue(g.label)}>{g.items.map((p) => <option key={translateValue(p.id)} value={translateValue(p.id)}>{p.name}{translateValue(p.generic ? " (genérico)" : "")}</option>)}</optgroup>)}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            {translateValue(panel.widthMm)}×{translateValue(panel.heightMm)} {t("mm ·")} {translateValue(panel.resX)}×{translateValue(panel.resY)} {t("px · pitch real")} {translateValue(realPitch(panel).x.toFixed(3))} {t("mm")} {translateValue(panel.generic && " · Preset genérico editable, sin compatibilidad mecánica asumida.")}
          </p>
          {panel.orientations.includes("horizontal") && (
            <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={translateValue(rotated)} onChange={(e) => setGrid(cols, rows, panel, e.target.checked)} /> {t("Girar 90° (intercambia medidas y resolución)")}</label>
          )}
        </Card>

        <Card title={t("2 · Geometría")}>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("Tipo")}>
              <select className={translateValue(inputCls)} value={translateValue(screen.geometry.type)} onChange={(e) => mod((s) => { s.geometry.type = e.target.value as GeometryType; })}>
                <option value="plana">{t("Plana")}</option><option value="concava">{t("Cóncava")}</option><option value="convexa">{t("Convexa")}</option><option value="arco">{t("Arco parcial")}</option><option value="cilindro">{t("Cilindro 360°")}</option>
              </select>
            </Field>
            {screen.geometry.type !== "plana" && (
              <Field label={t("Construcción")}>
                <select className={translateValue(inputCls)} value={translateValue(screen.geometry.mode)} onChange={(e) => mod((s) => { s.geometry.mode = e.target.value as "facetada" | "continua"; })}>
                  <option value="facetada">{t("Rígida (facetada)")}</option><option value="continua">{t("Flexible (continua)")}</option>
                </select>
              </Field>
            )}
            {screen.geometry.type !== "plana" && screen.geometry.type !== "cilindro" && (
              <>
                <Field label={t("Parámetro de entrada")}>
                  <select className={translateValue(inputCls)} value={translateValue(screen.geometry.input)} onChange={(e) => mod((s) => { s.geometry.input = e.target.value as never; })}>
                    {screen.geometry.mode === "facetada" ? <option value="angulo">{t("Ángulo entre gabinetes")}</option> : <option value="radio">{t("Radio")}</option>}
                    <option value="apertura">{t("Apertura total")}</option>
                  </select>
                </Field>
                {screen.geometry.input === "apertura" ? (
                  <Field label={t("Apertura °")}><Num value={translateValue(screen.geometry.apertureDeg)} onChange={(v) => mod((s) => { s.geometry.apertureDeg = v ?? 0; })} /></Field>
                ) : screen.geometry.mode === "facetada" ? (
                  <Field label={t("Ángulo °")}><Num value={translateValue(screen.geometry.angleDeg)} step={translateValue(0.5)} onChange={(v) => mod((s) => { s.geometry.angleDeg = v ?? 0; })} /></Field>
                ) : (
                  <Field label={t("Radio mm")}><Num value={translateValue(screen.geometry.radiusMm)} onChange={(v) => mod((s) => { s.geometry.radiusMm = v ?? 0; })} /></Field>
                )}
              </>
            )}
          </div>
          {screen.geometry.type !== "plana" && <div className="mt-2 space-y-1">{curve.errors.map((e) => <Notice key={translateValue(e)} kind="error">{translateValue(e)}</Notice>)}{curve.warnings.map((e) => <Notice key={translateValue(e)}>{translateValue(e)}</Notice>)}</div>}
        </Card>

        <Card title={t("3 · Tamaño")}>
          <div className="mb-2 flex gap-1 rounded-lg bg-muted p-1 text-xs font-bold">
            {(["grilla", "metros"] as const).map((m) => <button key={translateValue(m)} onClick={() => setInputMode(m)} className={translateValue(`flex-1 rounded-md py-1.5 ${inputMode === m ? "bg-card shadow" : ""}`)}>{translateValue(m === "grilla" ? "Columnas × filas" : "Medidas en m")}</button>)}
          </div>
          {inputMode === "grilla" ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("Columnas")}><Num value={translateValue(cols)} min={translateValue(1)} onChange={(v) => v && setGrid(v, rows)} /></Field>
              <Field label={t("Filas")}><Num value={translateValue(rows)} min={translateValue(1)} onChange={(v) => v && setGrid(cols, v)} /></Field>
              {isMix && <p className="col-span-2 text-xs text-muted-foreground">{t("Pantalla mixta: al cambiar columnas/filas se reemplaza por un formato uniforme.")}</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t("Ancho deseado m")}><Num value={translateValue(wantW)} step={translateValue(0.1)} onChange={(v) => setWantW(v ?? 0)} /></Field>
                <Field label={t("Alto deseado m")}><Num value={translateValue(wantH)} step={translateValue(0.1)} onChange={(v) => setWantH(v ?? 0)} /></Field>
              </div>
              <div className="mt-2 space-y-1">
                {wantW > 0 && wantH > 0 && suggestSizes(panel, wantW * 1000, wantH * 1000, rotated).map((o) => (
                  <button key={translateValue(o.label)} onClick={() => setGrid(o.cols, o.rows)} className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-muted">
                    <span className="font-bold">{translateValue(o.label)}</span>
                    <span className="truncate">{translateValue(o.cols)}×{translateValue(o.rows)} → {translateValue(fmtM(o.widthMm))} × {translateValue(fmtM(o.heightMm))} ({translateValue(o.dW >= 0 ? "+" : "")}{translateValue(o.dW)} / {translateValue(o.dH >= 0 ? "+" : "")}{translateValue(o.dH)} {t("mm)")}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-bold text-secondary-foreground">{t("Proporciones cercanas a 16:9")}</summary>
            <div className="mt-1 flex flex-wrap gap-1">{near169(panel).map((o) => <button key={translateValue(`${o.cols}x${o.rows}`)} className="rounded bg-muted px-2 py-1" onClick={() => setGrid(o.cols, o.rows)}>{translateValue(o.cols)}×{translateValue(o.rows)} ({translateValue(o.errPct >= 0 ? "+" : "")}{translateValue(o.errPct.toFixed(2))}%)</button>)}</div>
          </details>
        </Card>

        <Card title={t("Mezcla 500×500 + 500×1000")}>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("Chico (celda)")}><select className={translateValue(inputCls)} value={translateValue(smallId)} onChange={(e) => setSmallId(e.target.value)}>{panels.map((p) => <option key={translateValue(p.id)} value={translateValue(p.id)}>{p.name}</option>)}</select></Field>
            <Field label={t("Grande (2 celdas)")}><select className={translateValue(inputCls)} value={translateValue(largeId)} onChange={(e) => setLargeId(e.target.value)}>{panels.map((p) => <option key={translateValue(p.id)} value={translateValue(p.id)}>{p.name}</option>)}</select></Field>
            <Field label={t("Ancho m")}><Num value={translateValue(wantW)} step={translateValue(0.5)} onChange={(v) => setWantW(v ?? 0)} /></Field>
            <Field label={t("Alto m")}><Num value={translateValue(wantH)} step={translateValue(0.5)} onChange={(v) => setWantH(v ?? 0)} /></Field>
            <Field label={t("Stock chicos")}><Num value={translateValue(stockS)} min={translateValue(0)} onChange={translateValue(setStockS)} /></Field>
            <Field label={t("Stock grandes")}><Num value={translateValue(stockL)} min={translateValue(0)} onChange={translateValue(setStockL)} /></Field>
            <Field label={t("Objetivo")}><select className={translateValue(inputCls)} value={translateValue(goal)} onChange={(e) => setGoal(e.target.value as MixGoal)}><option value="menos">{t("Menos gabinetes")}</option><option value="stock">{t("Aprovechar stock")}</option><option value="grandes">{t("Priorizar 500×1000")}</option><option value="chicos">{t("Priorizar 500×500")}</option></select></Field>
            <Field label={t("Banda chica")}><select className={translateValue(inputCls)} value={translateValue(band)} onChange={(e) => setBand(e.target.value as "arriba" | "abajo")}><option value="arriba">{t("Arriba")}</option><option value="abajo">{t("Abajo")}</option></select></Field>
          </div>
          <label className="mt-2 flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={translateValue(screen.mixConfirmed)} onChange={(e) => mod((s) => { s.mixConfirmed = e.target.checked; })} />{t("Confirmo que ambos formatos son de la misma familia con compatibilidad mecánica y de montaje verificada.")}</label>
          {!compat.ok && <div className="mt-2 space-y-1">{compat.reasons.map((r) => <Notice key={translateValue(r)}>{translateValue(r)}</Notice>)}</div>}
          <div className="mt-2 space-y-1.5">
            {opts.map((o) => (
              <div key={o.name} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2"><b>{o.name}</b>
                  <Btn className="h-7 text-xs" disabled={translateValue(!o.feasible)} onClick={() => mixInp && mod((s) => { s.cabinets = buildMix(mixInp, o, band); })}>{t("Aplicar")}</Btn></div>
                <div>{translateValue(o.large)} {t("grandes +")} {translateValue(o.small)} {t("chicos =")} <b>{translateValue(o.total)}</b> · {translateValue(fmtM(o.widthMm))} × {translateValue(fmtM(o.heightMm))} · {translateValue(o.resX)}×{translateValue(o.resY)} {t("px")}</div>
                <div className="text-muted-foreground">{t("Dif.:")} {translateValue(o.dW >= 0 ? "+" : "")}{translateValue(o.dW)} / {translateValue(o.dH >= 0 ? "+" : "")}{translateValue(o.dH)} {t("mm ·")} {translateValue(o.cols)} {t("col ·")} {translateValue(o.bands)} {t("bandas de 1 m +")} {translateValue(o.rows - 2 * o.bands)} {t("de 0,5 m")}</div>
                {!o.feasible && <div className="font-bold text-destructive">{t("Excede stock: faltan")} {translateValue(o.shortage.large)} {t("grandes /")} {translateValue(o.shortage.small)} {t("chicos")}</div>}
              </div>
            ))}
          </div>
          {isMix && <p className="mt-2 text-xs text-muted-foreground">{t("Tocá un gabinete grande en el plano para dividirlo en dos chicos, o un chico para unirlo con el contiguo vertical.")}</p>}
        </Card>
      </div>

      <div className="order-first min-w-0 space-y-3 lg:order-none">
        <Card title={t("Resultados")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <Stat label={translateValue(screen.geometry.type === "plana" ? "Ancho" : "Ancho desarrollado")} value={translateValue(fmtM(stats.widthMm))} />
            <Stat label={t("Alto")} value={translateValue(fmtM(stats.heightMm))} />
            <Stat label={t("Gabinetes")} value={translateValue(stats.count)} hint={stats.types.map((t) => `${t.count}× ${t.panel.widthMm}×${t.panel.heightMm}`).join(" + ")} />
            <Stat label={t("Superficie LED")} value={translateValue(`${stats.areaM2.toFixed(2)} m²`)} hint={translateValue(stats.covered ? "Sin huecos" : `Envolvente ${stats.envelopeM2.toFixed(2)} m²`)} />
            <Stat label={t("Resolución")} value={translateValue(`${stats.resX} × ${stats.resY}`)} />
            <Stat label={t("Píxeles totales")} value={translateValue(fmtN(stats.activePixels))} />
            <Stat label={t("Relación")} value={translateValue(stats.aspectLabel)} hint={translateValue(`${stats.diff169Pct >= 0 ? "+" : ""}${stats.diff169Pct.toFixed(2)}% vs 16:9`)} />
            <Stat label={t("Peso / consumo")} value={translateValue(stats.weightKg == null ? "Sin datos" : `${stats.weightKg} kg`)} hint={translateValue(stats.powerMaxW == null ? "Consumo: sin datos" : `${stats.powerMaxW} W máx.`)} />
            {screen.geometry.type !== "plana" && <>
              <Stat label={t("Apertura")} value={translateValue(`${curve.apertureDeg.toFixed(1)}°`)} hint={translateValue(curve.faceted ? `Giro ${curve.turnDeg.toFixed(2)}°` : "Continua")} />
              <Stat label={t("Radio")} value={translateValue(curve.radiusMm ? fmtM(curve.radiusMm) : "-")} hint={translateValue(curve.faceted && curve.radiusVertexMm ? `a vértices ${fmtM(curve.radiusVertexMm)}` : curve.radiusRef)} />
              <Stat label={t("Frente proyectado")} value={translateValue(fmtM(curve.frontWidthMm))} hint={translateValue(`Cuerda ${fmtM(curve.chordMm)}`)} />
              <Stat label={t("Profundidad")} value={translateValue(fmtM(curve.depthMm))} hint={translateValue(curve.outerDiameterMm ? `Ø exterior ${fmtM(curve.outerDiameterMm)}` : undefined)} />
            </>}
          </div>
          {stats.overlaps && <div className="mt-2"><Notice kind="error">{t("Hay gabinetes superpuestos.")}</Notice></div>}
          {stats.mixedPitch && <div className="mt-2"><Notice>{t("La pantalla mezcla pitches distintos.")}</Notice></div>}
        </Card>
        <Card title={t("Plano")} actions={
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex gap-1" role="group" aria-label={t("Tipo de plano")}>
              <Btn className="h-7 px-2 text-xs" variant={translateValue(!showWiring ? "default" : "outline")} onClick={() => setShowWiring(false)}>{t("Gabinetes")}</Btn>
              <Btn className="h-7 px-2 text-xs" variant={translateValue(showWiring ? "default" : "outline")} onClick={() => setShowWiring(true)}>{t("Cableado")}</Btn>
            </div>
            <label className="flex items-center gap-1"><input type="checkbox" checked={translateValue(showDims)} onChange={(e) => setShowDims(e.target.checked)} />{t("Cotas")}</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={translateValue(showNums)} onChange={(e) => setShowNums(e.target.checked)} />{t("Numeración")}</label>
            <select className="rounded border border-input bg-background px-1" value={translateValue(screen.numbering.order)} onChange={(e) => mod((s) => { s.numbering.order = e.target.value as never; })}>
              <option value="filas">{t("Por filas")}</option><option value="columnas">{t("Por columnas")}</option><option value="serpentina">{t("Serpentina")}</option>
            </select>
            <select className="rounded border border-input bg-background px-1" value={translateValue(screen.numbering.start)} onChange={(e) => mod((s) => { s.numbering.start = e.target.value as never; })}>
              <option value="tl">{t("Inicio ↖")}</option><option value="tr">{t("Inicio ↗")}</option><option value="bl">{t("Inicio ↙")}</option><option value="br">{t("Inicio ↘")}</option>
            </select>
          </div>}>
          {!showWiring && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-md bg-muted p-1.5 text-xs">
              <span className="font-bold text-muted-foreground">{t("Editar en el plano:")}</span>
              {([["agregar", "＋ Agregar"], ["quitar", "− Quitar"], ["girar", "↻ Girar"], ["intercambiar", "⇄ Intercambiar"]] as const).map(([k, l]) => (
                <Btn key={translateValue(k)} className="h-7 px-2 text-xs" variant={translateValue(tool === k ? "default" : "outline")} onClick={() => { setTool(k); setEditMsg(null); }}>{translateValue(l)}</Btn>
              ))}
              {tool === "girar" && <>
                <Btn className="h-7 px-2 text-xs" disabled={translateValue(!pick.size)} onClick={() => rotatePick(pick)}>↻ 90° {translateValue(pick.size === 1 ? "panel" : `grupo (${pick.size})`)}</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" disabled={translateValue(!pick.size)} title={t("Girar 1° antihorario")} onClick={() => spin(-1)}>↺ 1°</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" disabled={translateValue(!pick.size)} title={t("Girar 1° horario")} onClick={() => spin(1)}>↻ 1°</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" disabled={translateValue(!pick.size)} title={t("Girar 5° antihorario")} onClick={() => spin(-5)}>↺ 5°</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" disabled={translateValue(!pick.size)} title={t("Girar 5° horario")} onClick={() => spin(5)}>↻ 5°</Btn>
                <span className="flex items-center gap-1"><Num className="h-7 w-20" value={translateValue(manualDeg)} onChange={translateValue(setManualDeg)} step={translateValue(0.5)} />°
                  <Btn variant="outline" className="h-7 px-2 text-xs" disabled={translateValue(!pick.size || !manualDeg)} onClick={() => spin(manualDeg ?? 0)}>{t("Aplicar")}</Btn></span>
                <Btn variant="ghost" className="h-7 px-2 text-xs" disabled={!pick.size || !screen.cabinets.some((k) => pick.has(k.id) && k.angleDeg)} title={t("Quitar giro libre")} onClick={() => mod((s) => { s.cabinets.forEach((k) => { if (pick.has(k.id)) delete k.angleDeg; }); })}>0°</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" onClick={() => rotatePick(new Set(screen.cabinets.map((k) => k.id)))}>{t("↻ Girar pantalla completa")}</Btn>
                <ScreenRotation screen={translateValue(screen)} onChange={(values) => mod((s) => { s.mountHeightM = sceneHeight(s, lookup); Object.assign(s, values); })} />
                <span className="flex items-center gap-1 rounded border border-input bg-background px-1.5" title={t("Altura libre de la base de la pantalla sobre el suelo (solo vistas 3D/espacial). Sirve para que las pantallas de techo no choquen con las de pared.")}>
                  <span className="font-bold text-muted-foreground">{t("Altura")}</span>
                  <Num className="h-7 w-16" value={translateValue(screen.mountHeightM)} step={translateValue(0.1)} onChange={(v) => mod((s) => { if (v == null) delete s.mountHeightM; else s.mountHeightM = Math.max(0, v); })} />{t("m")} </span>
                <Btn variant="outline" className="h-7 px-2 text-xs" onClick={() => setPick(new Set(screen.cabinets.map((k) => k.id)))}>{t("Seleccionar todos")}</Btn>
                <Btn variant="ghost" className="h-7 px-2 text-xs" disabled={translateValue(!pick.size)} onClick={() => setPick(new Set())}>{t("Limpiar")}</Btn>
              </>}
              {tool === "agregar" && <select className="h-7 max-w-[180px] rounded border border-input bg-background px-1" value={translateValue(addPanelId || panel.id)} onChange={(e) => setAddPanelId(e.target.value)}>
                {[...new Set([panel.id, ...stats.types.map((t) => t.panel.id), smallId, largeId])].map((id) => lookup(id)).filter((x): x is Panel => !!x).map((x) => <option key={translateValue(x.id)} value={translateValue(x.id)}>{x.name}</option>)}
              </select>}
              <span className="ml-auto flex gap-1">
                <Btn variant="outline" className="h-7 px-2 text-xs" title={t("Agregar columna a la derecha")} onClick={() => edge("col", true)}>{t("+ Col")}</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" title={t("Quitar última columna")} onClick={() => edge("col", false)}>{t("− Col")}</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" title={t("Agregar fila abajo")} onClick={() => edge("row", true)}>{t("+ Fila")}</Btn>
                <Btn variant="outline" className="h-7 px-2 text-xs" title={t("Quitar última fila")} onClick={() => edge("row", false)}>{t("− Fila")}</Btn>
              </span>
              <p className="w-full text-muted-foreground">{translateValue(tool === "agregar" ? "Clic en un espacio vacío junto a la pantalla para sumar un gabinete." : tool === "quitar" ? "Clic en un gabinete para quitarlo." : tool === "girar" ? "Clic en uno o varios gabinetes para seleccionarlos (borde naranja) y después Girar: un panel gira en su lugar, un grupo gira como bloque. 90° cambia la orientación real; ↺/↻ 5° o grados a mano son giros parciales de esquema (no cambian píxeles ni validan montaje)." : "Clic en un gabinete grande para dividirlo en dos chicos, o en uno chico para unirlo.")}</p>
            </div>
          )}
          {editMsg && !showWiring && <div className="mb-2"><Notice>{translateValue(editMsg)}</Notice></div>}
          {showWiring && wiring.errors.map((e) => <Notice key={translateValue(e)} kind="error">{translateValue(e)}</Notice>)}
          <PlanView plan={showWiring ? wp : tool === "girar" && pick.size ? { ...fp, prims: [...fp.prims, ...screen.cabinets.filter((k) => pick.has(k.id)).map((k) => { const b = box(k); return { t: "rect" as const, x: b.x, y: b.y, w: b.w, h: b.h, stroke: "#F5A524", lw: Math.min(b.w, b.h) * 0.06, rot: k.angleDeg || undefined }; })] } : fp} className="h-auto max-h-[60vh] w-full" onCabinetClick={translateValue(showWiring ? undefined : onPlanClick)} />
          {tp && !showWiring && <div className="mt-4 border-t border-border pt-3"><p className="mb-1 text-xs font-bold text-muted-foreground">{t("Vista superior (esquema)")}</p><PlanView plan={translateValue(tp)} className="h-auto max-h-[45vh] w-full" /></div>}
        </Card>
      </div>
    </div>
  );
}

export type { Panel };
