import { useState } from "react";
import { validatePanel, type Panel, type Usage } from "@/lib/led/catalog";
import { uid } from "@/lib/led/model";
import { Btn, Field, inputCls, Num, Notice } from "./ui";

const blank = (): Panel => ({
  id: "custom-" + uid(), name: "", usage: "rental", category: "custom", widthMm: 500, heightMm: 500, resX: 128, resY: 128,
  orientations: ["vertical"], curvable: false, construction: "rigida", generic: false, custom: true,
});

export function PanelDialog({ initial, onSave, onClose }: { initial?: Panel; onSave: (p: Panel) => void; onClose: () => void }) {
  const [p, setP] = useState<Panel>(initial ? { ...initial } : blank());
  const errs = validatePanel(p);
  const set = <K extends keyof Panel>(k: K, v: Panel[K]) => setP((x) => ({ ...x, [k]: v }));
  const txt = (k: keyof Panel, label: string) => (
    <Field label={label}><input className={inputCls} value={(p[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} /></Field>
  );
  const num = (k: keyof Panel, label: string) => (
    <Field label={label}><Num value={p[k] as number | undefined} onChange={(v) => set(k, v as never)} min={0} /></Field>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-extrabold">{initial ? "Editar panel" : "Crear panel personalizado"}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {txt("name", "Nombre *")}{txt("brand", "Marca")}{txt("model", "Modelo")}
          <Field label="Uso">
            <select className={inputCls} value={p.usage} onChange={(e) => set("usage", e.target.value as Usage)}>
              {["indoor", "outdoor", "rental", "instalacion", "piso", "transparente"].map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>
          {num("widthMm", "Ancho mm *")}{num("heightMm", "Alto mm *")}{num("resX", "Píxeles H *")}{num("resY", "Píxeles V *")}
          {txt("pitchName", "Pitch comercial")}{txt("family", "Familia compatible")}
          <Field label="Familia confirmada">
            <select className={inputCls} value={p.familyConfirmed ? "si" : "no"} onChange={(e) => set("familyConfirmed", e.target.value === "si")}><option value="no">No</option><option value="si">Sí</option></select>
          </Field>
          <Field label="Montaje admitido">
            <select className={inputCls} value={p.orientations.join(",")} onChange={(e) => set("orientations", e.target.value.split(",") as Panel["orientations"])}>
              <option value="vertical">Vertical</option><option value="horizontal">Horizontal</option><option value="vertical,horizontal">Ambos</option>
            </select>
          </Field>
          {num("weightKg", "Peso kg")}{num("powerMaxW", "Consumo máx. W")}{num("powerAvgW", "Consumo prom. W")}{num("perCase", "Por flight case")}
          {num("moduleWmm", "Módulo ancho mm")}{num("moduleHmm", "Módulo alto mm")}{num("moduleResX", "Módulo px H")}{num("moduleResY", "Módulo px V")}
          <Field label="Admite curvatura">
            <select className={inputCls} value={p.curvable ? "si" : "no"} onChange={(e) => set("curvable", e.target.value === "si")}><option value="no">No</option><option value="si">Sí</option></select>
          </Field>
          <Field label="Construcción">
            <select className={inputCls} value={p.construction} onChange={(e) => set("construction", e.target.value as Panel["construction"])}><option value="rigida">Rígida articulada</option><option value="flexible">Flexible</option></select>
          </Field>
          {num("angleMinDeg", "Ángulo mín °")}{num("angleMaxDeg", "Ángulo máx °")}{num("angleStepDeg", "Incremento °")}{num("minRadiusMm", "Radio mín mm")}
          {txt("source", "Fuente de especificaciones")}
          <Field label="Observaciones" className="col-span-2 sm:col-span-3"><input className={inputCls} value={p.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        {p.widthMm > 0 && p.resX > 0 && <p className="mt-3 text-xs text-muted-foreground">Pitch real: {(p.widthMm / p.resX).toFixed(3)} × {(p.heightMm / p.resY).toFixed(3)} mm</p>}
        <div className="mt-3 space-y-1">{errs.map((e) => <Notice key={e} kind="error">{e}</Notice>)}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
          <Btn disabled={errs.some((e) => !e.startsWith("El pitch comercial"))} onClick={() => onSave({ ...p, custom: true, generic: false, category: "custom" })}>Guardar panel</Btn>
        </div>
      </div>
    </div>
  );
}
