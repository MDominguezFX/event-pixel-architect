import { LanguageSelector } from "./LanguageSelector";
import { t, translateValue, useLocale } from "@/lib/i18n/react";
import { useEffect, useRef, useState } from "react";
import { Moon, Sun, FileDown, FileJson, FolderOpen, FilePlus2, CopyPlus, Instagram, Globe } from "lucide-react";
import { manssoLogo, startLogo } from "@/assets/footer-logos";
import { BUILTIN_PANELS, type Panel } from "@/lib/led/catalog";
import { exportJson, download } from "@/lib/led/exporters";
import { ExportDialog } from "./ExportDialog";
import { WiringPanel } from "./WiringPanel";
import { View3DCard } from "./View3DCard";
import { newProject, uid, type Project } from "@/lib/led/model";
import { deleteProject, loadAll, validateProject } from "@/lib/led/persistence";
import { allPanels, initStore, setCustomPanels, setProject, update, useStore } from "@/lib/led/store";
import { MappingPanel } from "./MappingPanel";
import { PanelDialog } from "./PanelDialog";
import { ProEditor } from "./ProEditor";
import { ScreenConfig } from "./ScreenConfig";
import { Btn, Card, Field, inputCls, Notice } from "./ui";

export function LedPlanner() {
  useLocale();
  const st = useStore();
  const [pro, setPro] = useState(false);
  const [dark, setDark] = useState(false);
  const [sel, setSel] = useState("");
  const [tab, setTab] = useState<"diseño" | "cableado" | "mapeo" | "catalogo">("diseño");
  const [panelDlg, setPanelDlg] = useState<{ open: boolean; initial?: Panel }>({ open: false });
  const [exportOpen, setExportOpen] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [openList, setOpenList] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const catRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initStore();
    setPro(localStorage.getItem("mansso.pro") === "1");
    setDark(localStorage.getItem("mansso.dark") === "1");
  }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("mansso.dark", dark ? "1" : "0"); }, [dark]);
  useEffect(() => { localStorage.setItem("mansso.pro", pro ? "1" : "0"); }, [pro]);

  const p = st.project;
  const panels = allPanels(st);
  const lookup = (id: string) => panels.find((x) => x.id === id);
  const screen = p.screens.find((s) => s.id === sel) ?? p.screens[0]!;

  const withPanels = (): Project => {
    const used = new Set(p.screens.flatMap((s) => s.cabinets.map((c) => c.panelId)));
    return { ...p, customPanels: panels.filter((x) => x.custom && used.has(x.id)) };
  };
  const savePanel = (np: Panel) => {
    const list = st.customPanels.filter((x) => x.id !== np.id).concat(np);
    setCustomPanels(list);
    update((pr) => { pr.customPanels = pr.customPanels.map((x) => (x.id === np.id ? np : x)); return pr; }, false);
    setPanelDlg({ open: false });
  };
  const importProject = async (f: File) => {
    try {
      const { project, errors } = validateProject(JSON.parse(await f.text()));
      if (!project) return setMsg({ kind: "error", text: errors.join(" ") });
      const missing = project.screens.flatMap((s) => s.cabinets).filter((c) => !BUILTIN_PANELS.some((b) => b.id === c.panelId) && !project.customPanels.some((b) => b.id === c.panelId));
      if (missing.length) return setMsg({ kind: "error", text: `El proyecto usa ${missing.length} gabinetes con paneles no incluidos.` });
      setCustomPanels([...st.customPanels.filter((x) => !project.customPanels.some((y) => y.id === x.id)), ...project.customPanels]);
      setProject(project); setSel(project.screens[0]!.id); setMsg({ kind: "info", text: `Proyecto “${project.name}” importado.` });
    } catch { setMsg({ kind: "error", text: "JSON inválido." }); }
  };

  const projects = openList ? Object.values(loadAll()) : [];

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="sticky top-0 z-30 border-b border-primary/30 bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 min-[460px]:grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:flex sm:justify-between sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="min-w-0 border-l-2 border-primary pl-3 leading-tight">
              <h1 className="text-base font-black text-foreground sm:text-xl">{t("MANSSO")} <span className="text-primary">{t("PIXEL")}</span></h1>
              <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground sm:text-xs">{t("LED Planner")} <span className="hidden sm:inline">{t("· Una herramienta de Start Solution")}</span></div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <div className="flex rounded-md border border-border bg-muted p-0.5 text-xs font-bold" role="group" aria-label={t("Modo")}>
              <Btn onClick={() => setPro(false)} variant={!pro ? "default" : "ghost"} className="h-8 px-2.5 text-xs sm:px-3">{t("Simple")}</Btn>
              <Btn onClick={() => setPro(true)} variant={pro ? "default" : "ghost"} className="h-8 px-2.5 text-xs sm:px-3">{t("Pro")}</Btn>
            </div>
            <Btn variant="ghost" className="h-9 w-9 px-0" onClick={() => setDark(!dark)} title={t("Modo claro/oscuro")}>{dark ? <Sun size={18} /> : <Moon size={18} />}</Btn>
            <LanguageSelector />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-3 px-3 py-3 sm:px-4">
        {/* Proyecto + exportes */}
        <Card>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label={t("Proyecto")} className="col-span-2"><input className={inputCls} value={p.name} onChange={(e) => update((x) => ({ ...x, name: e.target.value }), false)} /></Field>
              <Field label={t("Cliente")}><input className={inputCls} value={p.client ?? ""} onChange={(e) => update((x) => ({ ...x, client: e.target.value }), false)} /></Field>
              <Field label={t("Revisión")}><input className={inputCls} value={p.revision} onChange={(e) => update((x) => ({ ...x, revision: e.target.value }), false)} /></Field>
            </div>
            <div className="flex flex-wrap items-end gap-1.5">
              <Btn variant="outline" title={t("Nuevo proyecto")} onClick={() => { const n = newProject(BUILTIN_PANELS[6]!); setProject(n); setSel(n.screens[0]!.id); }}><FilePlus2 size={16} /><span className="hidden sm:inline">{t("Nuevo")}</span></Btn>
              <Btn variant="outline" title={t("Abrir guardado")} onClick={() => setOpenList(!openList)}><FolderOpen size={16} /><span className="hidden sm:inline">{t("Abrir")}</span></Btn>
              <Btn variant="outline" title={t("Duplicar proyecto")} onClick={() => { const c = structuredClone(p); c.id = uid(); c.name += " (copia)"; setProject(c); }}><CopyPlus size={16} /><span className="hidden sm:inline">{t("Duplicar")}</span></Btn>
              <Btn variant="outline" onClick={() => fileRef.current?.click()}><FileJson size={16} />{t("Importar")}</Btn>
              <Btn variant="outline" onClick={() => exportJson(withPanels())}><FileJson size={16} />{t("JSON")}</Btn>
              <Btn onClick={() => setExportOpen(true)}><FileDown size={16} />{t("Exportar PDF / PNG")}</Btn>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importProject(f); e.target.value = ""; }} />
            </div>
          </div>
          {openList && (
            <div className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                  <button className="min-w-0 truncate text-left font-semibold" onClick={() => { setProject(x); setSel(x.screens[0]!.id); setOpenList(false); }}>{x.name} <span className="text-xs text-muted-foreground">· {translateValue(new Date(x.updatedAt).toLocaleString("es-AR"))}</span></button>
                  {x.id !== p.id && <button className="text-xs text-destructive" onClick={() => { deleteProject(x.id); setOpenList(false); setTimeout(() => setOpenList(true)); }}>{t("Eliminar")}</button>}
                </div>
              ))}
            </div>
          )}
          {msg && <div className="mt-2"><Notice kind={msg.kind}>{translateValue(msg.text)}</Notice></div>}
        </Card>

        {pro && (
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-sm font-bold">
            {(["diseño", "cableado", "mapeo", "catalogo"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-md px-4 py-1.5 ${tab === t ? "bg-card shadow" : "text-muted-foreground"}`}>{translateValue(t === "catalogo" ? "4 · Catálogo" : t === "mapeo" ? "3 · Canvas y Arena" : t === "cableado" ? "2 · Cableado" : "1 · Diseño")}</button>
            ))}
          </div>
        )}

        {(!pro || tab === "diseño") && (
          <>
            {pro && <div className="grid gap-3 xl:grid-cols-2"><ProEditor selected={screen.id} onSelect={setSel} /><View3DCard selected={screen.id} dark={dark} /></div>}
            {pro && p.screens.length > 1 && (
              <div className="flex gap-1 overflow-x-auto">
                {p.screens.map((s) => <button key={s.id} onClick={() => setSel(s.id)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${s.id === screen.id ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{s.name}</button>)}
              </div>
            )}
            <ScreenConfig screen={screen} dark={dark} onNewPanel={() => setPanelDlg({ open: true })} />
            {!pro && <View3DCard selected={screen.id} dark={dark} />}
          </>
        )}
        {pro && tab === "cableado" && p.screens.length > 1 && (
          <div className="flex gap-1 overflow-x-auto">
            {p.screens.map((s) => <button key={s.id} onClick={() => setSel(s.id)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${s.id === screen.id ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{s.name}</button>)}
          </div>
        )}
        {pro && tab === "cableado" && <WiringPanel screen={screen} dark={dark} />}
        {pro && tab === "mapeo" && <MappingPanel />}
        {(pro && tab === "catalogo") || !pro ? (
          <Card title={t("Paneles personalizados")} actions={
            <div className="flex flex-wrap gap-1">
              <Btn className="h-8 text-xs" onClick={() => setPanelDlg({ open: true })}>{t("+ Crear panel personalizado")}</Btn>
              <Btn variant="outline" className="h-8 text-xs" onClick={() => download("catalogo_mansso.json", JSON.stringify({ schemaVersion: 1, panels: st.customPanels }, null, 2), "application/json")}>{t("Exportar catálogo")}</Btn>
              <Btn variant="outline" className="h-8 text-xs" onClick={() => catRef.current?.click()}>{t("Importar catálogo")}</Btn>
              <input ref={catRef} type="file" accept=".json" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
                try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.panels)) throw 0; setCustomPanels([...st.customPanels.filter((x) => !d.panels.some((y: Panel) => y.id === x.id)), ...d.panels]); setMsg({ kind: "info", text: `${d.panels.length} paneles importados.` }); }
                catch { setMsg({ kind: "error", text: "Catálogo inválido." }); }
              }} />
            </div>}>
            {!st.customPanels.length ? <p className="text-xs text-muted-foreground">{t("Todavía no hay paneles personalizados. Los presets incluidos son genéricos y editables (duplicalos para ajustarlos).")}</p> : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {st.customPanels.map((x) => (
                  <div key={x.id} className="rounded-lg border border-border p-2 text-xs">
                    <div className="truncate font-bold">{x.name}</div>
                    <div className="text-muted-foreground">{translateValue(x.widthMm)}×{translateValue(x.heightMm)} {t("mm ·")} {translateValue(x.resX)}×{translateValue(x.resY)} {t("px ·")} {translateValue(x.weightKg != null ? `${x.weightKg} kg` : "Peso: sin datos")}</div>
                    <div className="mt-1 flex gap-1">
                      <Btn variant="outline" className="h-7 text-xs" onClick={() => setPanelDlg({ open: true, initial: x })}>{t("Editar")}</Btn>
                      <Btn variant="outline" className="h-7 text-xs" onClick={() => savePanel({ ...x, id: "custom-" + uid(), name: x.name + " (copia)" })}>{t("Duplicar")}</Btn>
                      <Btn variant="ghost" className="h-7 text-xs text-destructive" disabled={p.screens.some((s) => s.cabinets.some((c) => c.panelId === x.id))} onClick={() => setCustomPanels(st.customPanels.filter((y) => y.id !== x.id))}>{t("Eliminar")}</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pro && <details className="mt-3 text-xs"><summary className="cursor-pointer font-bold">{t("Presets genéricos incluidos (")}{translateValue(BUILTIN_PANELS.length)})</summary>
              <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{BUILTIN_PANELS.map((x) => <div key={x.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1"><span className="truncate">{x.name} · {translateValue(x.resX)}×{translateValue(x.resY)}</span><button className="text-primary" onClick={() => savePanel({ ...x, id: "custom-" + uid(), name: x.name + " (editable)", generic: false, custom: true, category: "custom" })}>{t("Duplicar")}</button></div>)}</div>
            </details>}
          </Card>
        ) : null}
      </main>
      {exportOpen && <ExportDialog project={withPanels()} screen={screen} lookup={lookup} pro={pro} onClose={() => setExportOpen(false)} />}

      <footer className="mt-6 border-t border-primary/30 bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-3 px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground"> {t("Desarrollado por")}{translateValue(" ")}
            <a href="https://startsolution.com.ar/" target="_blank" rel="noopener noreferrer" className="font-bold text-secondary-foreground underline-offset-2 hover:underline">{t("Start Solution")}</a>
          </p>
          <div className="flex max-w-full items-center justify-center gap-6 rounded-md bg-brand-surface px-5 py-3 sm:gap-8">
            <img src={manssoLogo} alt="MANSSO TIP" className="h-auto max-h-11 w-28 object-contain sm:w-32" />
            <span className="h-8 w-px shrink-0 bg-brand-divider" aria-hidden="true" />
            <a href="https://startsolution.com.ar/" target="_blank" rel="noopener noreferrer"><img src={startLogo} alt="Start Solution" className="h-auto max-h-11 w-28 object-contain sm:w-32" /></a>
          </div>
          <nav className="flex flex-wrap justify-center gap-2 text-sm" aria-label={t("Redes")}>
            <a href="https://www.instagram.com/manssotip/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 px-2 text-muted-foreground hover:text-primary"><Instagram size={16} />{t("@manssotip")}</a>
            <a href="https://www.instagram.com/startsolution.ar/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 px-2 text-muted-foreground hover:text-primary"><Instagram size={16} />{t("@startsolution.ar")}</a>
            <a href="https://startsolution.com.ar/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 px-2 text-muted-foreground hover:text-primary"><Globe size={16} />{t("startsolution.com.ar")}</a>
          </nav>
          <p className="max-w-2xl text-[11px] text-muted-foreground">{t("MANSSO PIXEL documenta geometría y configuración. No valida estructura, rigging ni montaje mecánico. Datos guardados sólo en este navegador.")}</p>
        </div>
      </footer>

      {panelDlg.open && <PanelDialog initial={panelDlg.initial} onSave={savePanel} onClose={() => setPanelDlg({ open: false })} />}
    </div>
  );
}
