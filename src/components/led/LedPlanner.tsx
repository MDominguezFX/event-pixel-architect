import { useEffect, useRef, useState } from "react";
import { Moon, Sun, FileDown, ImageDown, FileJson, FolderOpen, FilePlus2, CopyPlus, Instagram, Globe } from "lucide-react";
import manssoLogo from "@/assets/mansso-logo.png.asset.json";
import startLogo from "@/assets/start-solution-logo.png.asset.json";
import { BUILTIN_PANELS, type Panel } from "@/lib/led/catalog";
import { exportJson, exportPdf, exportPng, download, type PngOpts, type PdfOpts } from "@/lib/led/exporters";
import { newProject, uid, type Project } from "@/lib/led/model";
import { deleteProject, loadAll, validateProject } from "@/lib/led/persistence";
import { allPanels, initStore, setCustomPanels, setProject, update, useStore } from "@/lib/led/store";
import { MappingPanel } from "./MappingPanel";
import { PanelDialog } from "./PanelDialog";
import { ProEditor } from "./ProEditor";
import { ScreenConfig } from "./ScreenConfig";
import { Btn, Card, Field, inputCls, Notice } from "./ui";

export function LedPlanner() {
  const st = useStore();
  const [pro, setPro] = useState(false);
  const [dark, setDark] = useState(false);
  const [sel, setSel] = useState("");
  const [tab, setTab] = useState<"diseño" | "mapeo" | "catalogo">("diseño");
  const [panelDlg, setPanelDlg] = useState<{ open: boolean; initial?: Panel }>({ open: false });
  const [png, setPng] = useState<PngOpts>({ bg: "blanco", dims: true, numbers: true, width: 2400, view: "ambas" });
  const [pdf, setPdf] = useState<PdfOpts>({ size: "a4", orientation: "landscape" });
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
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:flex sm:justify-between sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img src={manssoLogo.url} alt="MANSSO TIP" className="h-8 w-auto shrink-0 sm:h-10" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-base font-black tracking-tight text-deep sm:text-lg">PIXEL <span className="font-semibold text-muted-foreground">· LED Planner</span></div>
              <div className="hidden truncate text-[11px] text-muted-foreground sm:block">Una herramienta de Start Solution</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="flex rounded-full bg-muted p-0.5 text-xs font-bold" role="group" aria-label="Modo">
              <button onClick={() => setPro(false)} className={`rounded-full px-2.5 py-1.5 sm:px-3 ${!pro ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Simple</button>
              <button onClick={() => setPro(true)} className={`rounded-full px-2.5 py-1.5 sm:px-3 ${pro ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Pro</button>
            </div>
            <Btn variant="ghost" className="h-9 w-9 px-0" onClick={() => setDark(!dark)} title="Modo claro/oscuro">{dark ? <Sun size={18} /> : <Moon size={18} />}</Btn>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-3 px-3 py-3 sm:px-4">
        {/* Proyecto + exportes */}
        <Card>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Proyecto" className="col-span-2"><input className={inputCls} value={p.name} onChange={(e) => update((x) => ({ ...x, name: e.target.value }), false)} /></Field>
              <Field label="Cliente"><input className={inputCls} value={p.client ?? ""} onChange={(e) => update((x) => ({ ...x, client: e.target.value }), false)} /></Field>
              <Field label="Revisión"><input className={inputCls} value={p.revision} onChange={(e) => update((x) => ({ ...x, revision: e.target.value }), false)} /></Field>
            </div>
            <div className="flex flex-wrap items-end gap-1.5">
              <Btn variant="outline" title="Nuevo proyecto" onClick={() => { const n = newProject(BUILTIN_PANELS[6]!); setProject(n); setSel(n.screens[0]!.id); }}><FilePlus2 size={16} /><span className="hidden sm:inline">Nuevo</span></Btn>
              <Btn variant="outline" title="Abrir guardado" onClick={() => setOpenList(!openList)}><FolderOpen size={16} /><span className="hidden sm:inline">Abrir</span></Btn>
              <Btn variant="outline" title="Duplicar proyecto" onClick={() => { const c = structuredClone(p); c.id = uid(); c.name += " (copia)"; setProject(c); }}><CopyPlus size={16} /><span className="hidden sm:inline">Duplicar</span></Btn>
              <Btn variant="outline" onClick={() => fileRef.current?.click()}><FileJson size={16} />Importar</Btn>
              <Btn variant="outline" onClick={() => exportJson(withPanels())}><FileJson size={16} />JSON</Btn>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importProject(f); e.target.value = ""; }} />
            </div>
          </div>
          {openList && (
            <div className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                  <button className="min-w-0 truncate text-left font-semibold" onClick={() => { setProject(x); setSel(x.screens[0]!.id); setOpenList(false); }}>{x.name} <span className="text-xs text-muted-foreground">· {new Date(x.updatedAt).toLocaleString("es-AR")}</span></button>
                  {x.id !== p.id && <button className="text-xs text-destructive" onClick={() => { deleteProject(x.id); setOpenList(false); setTimeout(() => setOpenList(true)); }}>Eliminar</button>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-2">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Fondo PNG"><select className={inputCls} value={png.bg} onChange={(e) => setPng({ ...png, bg: e.target.value as PngOpts["bg"] })}><option value="blanco">Blanco</option><option value="oscuro">Oscuro</option><option value="transparente">Transparente</option></select></Field>
              <Field label="Ancho px"><select className={inputCls} value={png.width} onChange={(e) => setPng({ ...png, width: Number(e.target.value) })}><option value={1600}>1600</option><option value={2400}>2400</option><option value={4000}>4000</option></select></Field>
              {screen.geometry.type !== "plana" && <Field label="Vista"><select className={inputCls} value={png.view} onChange={(e) => setPng({ ...png, view: e.target.value as PngOpts["view"] })}><option value="frontal">Desarrollada</option><option value="superior">Superior</option><option value="ambas">Ambas</option></select></Field>}
              <label className="flex h-9 items-center gap-1 text-xs"><input type="checkbox" checked={png.dims} onChange={(e) => setPng({ ...png, dims: e.target.checked })} />Cotas</label>
              <label className="flex h-9 items-center gap-1 text-xs"><input type="checkbox" checked={png.numbers} onChange={(e) => setPng({ ...png, numbers: e.target.checked })} />Números</label>
              <Btn onClick={() => exportPng(p, screen, lookup, png)}><ImageDown size={16} />Descargar PNG</Btn>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Hoja"><select className={inputCls} value={pdf.size} onChange={(e) => setPdf({ ...pdf, size: e.target.value as PdfOpts["size"] })}><option value="a4">A4</option><option value="a3">A3</option></select></Field>
              <Field label="Orientación"><select className={inputCls} value={pdf.orientation} onChange={(e) => setPdf({ ...pdf, orientation: e.target.value as PdfOpts["orientation"] })}><option value="landscape">Horizontal</option><option value="portrait">Vertical</option></select></Field>
              <Btn onClick={() => exportPdf(withPanels(), lookup, pdf, pro)}><FileDown size={16} />Descargar PDF</Btn>
            </div>
          </div>
          {msg && <div className="mt-2"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
        </Card>

        {pro && (
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-sm font-bold">
            {(["diseño", "mapeo", "catalogo"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-md px-4 py-1.5 capitalize ${tab === t ? "bg-card shadow" : "text-muted-foreground"}`}>{t === "catalogo" ? "Catálogo" : t === "mapeo" ? "Canvas y slices" : "Diseño"}</button>
            ))}
          </div>
        )}

        {(!pro || tab === "diseño") && (
          <>
            {pro && <ProEditor selected={screen.id} onSelect={setSel} />}
            {pro && p.screens.length > 1 && (
              <div className="flex gap-1 overflow-x-auto">
                {p.screens.map((s) => <button key={s.id} onClick={() => setSel(s.id)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${s.id === screen.id ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{s.name}</button>)}
              </div>
            )}
            <ScreenConfig screen={screen} dark={dark} onNewPanel={() => setPanelDlg({ open: true })} />
          </>
        )}
        {pro && tab === "mapeo" && <MappingPanel />}
        {(pro && tab === "catalogo") || !pro ? (
          <Card title="Paneles personalizados" actions={
            <div className="flex flex-wrap gap-1">
              <Btn className="h-8 text-xs" onClick={() => setPanelDlg({ open: true })}>+ Crear panel personalizado</Btn>
              <Btn variant="outline" className="h-8 text-xs" onClick={() => download("catalogo_mansso.json", JSON.stringify({ schemaVersion: 1, panels: st.customPanels }, null, 2), "application/json")}>Exportar catálogo</Btn>
              <Btn variant="outline" className="h-8 text-xs" onClick={() => catRef.current?.click()}>Importar catálogo</Btn>
              <input ref={catRef} type="file" accept=".json" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
                try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.panels)) throw 0; setCustomPanels([...st.customPanels.filter((x) => !d.panels.some((y: Panel) => y.id === x.id)), ...d.panels]); setMsg({ kind: "info", text: `${d.panels.length} paneles importados.` }); }
                catch { setMsg({ kind: "error", text: "Catálogo inválido." }); }
              }} />
            </div>}>
            {!st.customPanels.length ? <p className="text-xs text-muted-foreground">Todavía no hay paneles personalizados. Los presets incluidos son genéricos y editables (duplicalos para ajustarlos).</p> : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {st.customPanels.map((x) => (
                  <div key={x.id} className="rounded-lg border border-border p-2 text-xs">
                    <div className="truncate font-bold">{x.name}</div>
                    <div className="text-muted-foreground">{x.widthMm}×{x.heightMm} mm · {x.resX}×{x.resY} px · {x.weightKg != null ? `${x.weightKg} kg` : "Peso: sin datos"}</div>
                    <div className="mt-1 flex gap-1">
                      <Btn variant="outline" className="h-7 text-xs" onClick={() => setPanelDlg({ open: true, initial: x })}>Editar</Btn>
                      <Btn variant="outline" className="h-7 text-xs" onClick={() => savePanel({ ...x, id: "custom-" + uid(), name: x.name + " (copia)" })}>Duplicar</Btn>
                      <Btn variant="ghost" className="h-7 text-xs text-destructive" disabled={p.screens.some((s) => s.cabinets.some((c) => c.panelId === x.id))} onClick={() => setCustomPanels(st.customPanels.filter((y) => y.id !== x.id))}>Eliminar</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pro && <details className="mt-3 text-xs"><summary className="cursor-pointer font-bold">Presets genéricos incluidos ({BUILTIN_PANELS.length})</summary>
              <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{BUILTIN_PANELS.map((x) => <div key={x.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1"><span className="truncate">{x.name} · {x.resX}×{x.resY}</span><button className="text-primary" onClick={() => savePanel({ ...x, id: "custom-" + uid(), name: x.name + " (editable)", generic: false, custom: true, category: "custom" })}>Duplicar</button></div>)}</div>
            </details>}
          </Card>
        ) : null}
      </main>

      <footer className="mt-6 border-t border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-4 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Desarrollado por{" "}
            <a href="https://startsolution.com.ar/" target="_blank" rel="noopener noreferrer" className="font-bold text-secondary-foreground underline-offset-2 hover:underline">Start Solution</a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            <img src={manssoLogo.url} alt="MANSSO TIP" className="h-10 w-auto sm:h-12" />
            <a href="https://startsolution.com.ar/" target="_blank" rel="noopener noreferrer"><img src={startLogo.url} alt="Start Solution" className="h-9 w-auto sm:h-11 dark:brightness-200" /></a>
          </div>
          <nav className="flex flex-wrap justify-center gap-2 text-sm" aria-label="Redes">
            <a href="https://www.instagram.com/manssotip/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 hover:bg-muted"><Instagram size={16} />@manssotip</a>
            <a href="https://www.instagram.com/startsolution.ar/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 hover:bg-muted"><Instagram size={16} />@startsolution.ar</a>
            <a href="https://startsolution.com.ar/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 hover:bg-muted"><Globe size={16} />startsolution.com.ar</a>
          </nav>
          <p className="max-w-2xl text-[11px] text-muted-foreground">MANSSO PIXEL documenta geometría y configuración. No valida estructura, rigging ni montaje mecánico. Datos guardados sólo en este navegador.</p>
        </div>
      </footer>

      {panelDlg.open && <PanelDialog initial={panelDlg.initial} onSave={savePanel} onClose={() => setPanelDlg({ open: false })} />}
    </div>
  );
}
