import { useState } from "react";
import { FileDown, ImageDown, X } from "lucide-react";
import type { PanelLookup } from "@/lib/led/engine";
import { exportPdf, exportPng, pdfPageCount, type PdfOpts, type PdfSection, type PngOpts } from "@/lib/led/exporters";
import type { Project, Screen } from "@/lib/led/model";
import { Btn, Field, inputCls, Notice } from "./ui";

const SECTIONS: { id: PdfSection; label: string; hint: string; pro?: boolean }[] = [
  { id: "frontal", label: "Plano frontal acotado", hint: "Gabinetes, medidas y numeración" },
  { id: "cableado", label: "Pixel Plot / cableado", hint: "Puertos por color, 650.000 px/cable" },
  { id: "datos", label: "Datos y equipamiento", hint: "Resolución, m², peso, consumo, cases" },
  { id: "superior", label: "Vista superior", hint: "Sólo pantallas curvas" },
  { id: "layout", label: "Layout general", hint: "Posición de todas las pantallas" },
  { id: "slices", label: "Mapa de slices", hint: "Tabla canvas → salida", pro: true },
];
const PRESETS: { label: string; s: PdfSection[] }[] = [
  { label: "Para el cliente", s: ["frontal", "datos"] },
  { label: "Para el técnico LED", s: ["frontal", "cableado"] },
  { label: "Para el operador de video", s: ["slices", "layout"] },
  { label: "Completo", s: ["layout", "frontal", "cableado", "superior", "datos", "slices"] },
];

export function ExportDialog({ project, screen, lookup, pro, onClose }: { project: Project; screen: Screen; lookup: PanelLookup; pro: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<"pdf" | "png">("pdf");
  const [secs, setSecs] = useState<PdfSection[]>(["frontal", "datos"]);
  const [ids, setIds] = useState<string[]>([screen.id]);
  const [pdf, setPdf] = useState<Omit<PdfOpts, "sections" | "screenIds">>({ size: "a4", orientation: "landscape" });
  const [png, setPng] = useState<PngOpts>({ bg: "blanco", dims: true, numbers: true, width: 2400, view: "ambas" });
  const [pngWiring, setPngWiring] = useState(false);
  const opts: PdfOpts = { ...pdf, sections: secs, screenIds: ids };
  const pages = pdfPageCount(project, lookup, opts, pro);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const pngScreen = project.screens.find((s) => s.id === ids[0]) ?? screen;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label="Exportar" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">¿Qué información querés exportar?</h2>
          <Btn variant="ghost" className="h-8 w-8 px-0" onClick={onClose} title="Cerrar"><X size={18} /></Btn>
        </div>
        <div className="mb-3 flex rounded-md bg-muted p-0.5 text-sm font-bold">
          {(["pdf", "png"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`flex-1 rounded py-1.5 ${kind === k ? "bg-card shadow" : "text-muted-foreground"}`}>{k === "pdf" ? "Documento PDF" : "Imagen PNG"}</button>)}
        </div>

        {project.screens.length > 1 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-bold text-muted-foreground">Pantallas</p>
            <div className="flex flex-wrap gap-1">
              {project.screens.map((s) => <button key={s.id} onClick={() => setIds(kind === "png" ? [s.id] : toggle(ids, s.id))} className={`rounded-full border px-3 py-1 text-xs font-bold ${ids.includes(s.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{s.name}</button>)}
            </div>
          </div>
        )}

        {kind === "pdf" ? (
          <>
            <p className="mb-1 text-xs font-bold text-muted-foreground">Atajos</p>
            <div className="mb-3 flex flex-wrap gap-1">{PRESETS.map((p) => <Btn key={p.label} variant="outline" className="h-7 text-xs" onClick={() => setSecs(p.s)}>{p.label}</Btn>)}</div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SECTIONS.filter((x) => !x.pro || pro).map((x) => (
                <label key={x.id} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${secs.includes(x.id) ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input type="checkbox" className="mt-1" checked={secs.includes(x.id)} onChange={() => setSecs(toggle(secs, x.id))} />
                  <span><span className="font-bold">{x.label}</span><span className="block text-xs text-muted-foreground">{x.hint}</span></span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Hoja"><select className={inputCls} value={pdf.size} onChange={(e) => setPdf({ ...pdf, size: e.target.value as PdfOpts["size"] })}><option value="a4">A4</option><option value="a3">A3</option></select></Field>
              <Field label="Orientación"><select className={inputCls} value={pdf.orientation} onChange={(e) => setPdf({ ...pdf, orientation: e.target.value as PdfOpts["orientation"] })}><option value="landscape">Horizontal</option><option value="portrait">Vertical</option></select></Field>
              <div className="ml-auto text-right text-sm"><span className="font-black text-primary">{pages}</span> {pages === 1 ? "hoja" : "hojas"}</div>
            </div>
            {!pages && <div className="mt-2"><Notice>Elegí al menos una sección y una pantalla.</Notice></div>}
            <Btn className="mt-3 w-full" disabled={!pages} onClick={() => { exportPdf(project, lookup, opts, pro); onClose(); }}><FileDown size={16} />Descargar PDF ({pages} {pages === 1 ? "hoja" : "hojas"})</Btn>
          </>
        ) : (
          <>
            <div className="mb-3 flex rounded-md border border-border p-0.5 text-xs font-bold">
              <button onClick={() => setPngWiring(false)} className={`flex-1 rounded py-1.5 ${!pngWiring ? "bg-primary text-primary-foreground" : ""}`}>Plano de gabinetes</button>
              <button onClick={() => setPngWiring(true)} className={`flex-1 rounded py-1.5 ${pngWiring ? "bg-primary text-primary-foreground" : ""}`}>Pixel Plot · cableado</button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Fondo"><select className={inputCls} value={png.bg} onChange={(e) => setPng({ ...png, bg: e.target.value as PngOpts["bg"] })}><option value="blanco">Blanco</option><option value="oscuro">Oscuro</option><option value="transparente">Transparente</option></select></Field>
              <Field label="Ancho px"><select className={inputCls} value={png.width} onChange={(e) => setPng({ ...png, width: Number(e.target.value) })}><option value={1600}>1600</option><option value={2400}>2400</option><option value={4000}>4000</option></select></Field>
              {pngScreen.geometry.type !== "plana" && !pngWiring && <Field label="Vista"><select className={inputCls} value={png.view} onChange={(e) => setPng({ ...png, view: e.target.value as PngOpts["view"] })}><option value="frontal">Desarrollada</option><option value="superior">Superior</option><option value="ambas">Ambas</option></select></Field>}
              <label className="flex h-9 items-center gap-1 text-xs"><input type="checkbox" checked={png.dims} onChange={(e) => setPng({ ...png, dims: e.target.checked })} />Cotas</label>
              <label className="flex h-9 items-center gap-1 text-xs"><input type="checkbox" checked={png.numbers} onChange={(e) => setPng({ ...png, numbers: e.target.checked })} />Números</label>
            </div>
            <Btn className="mt-3 w-full" onClick={() => { exportPng(project, pngScreen, lookup, { ...png, wiring: pngWiring }); onClose(); }}><ImageDown size={16} />Descargar PNG · {pngScreen.name}</Btn>
          </>
        )}
      </div>
    </div>
  );
}
