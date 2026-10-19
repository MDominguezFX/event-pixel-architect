import { t, translateValue, useLocale } from "@/lib/i18n/react";
import { useState } from "react";
import { validatePanel, type Panel, type Usage } from "@/lib/led/catalog";
import { uid } from "@/lib/led/model";
import { Btn, Field, inputCls, Num, Notice } from "./ui";

const blank = (): Panel => ({
  id: "custom-" + uid(), name: "", usage: "rental", category: "custom", widthMm: 500, heightMm: 500, resX: 128, resY: 128,
  orientations: ["vertical"], curvable: false, construction: "rigida", generic: false, custom: true,
});

export function PanelDialog({ initial, onSave, onClose }: { initial?: Panel; onSave: (p: Panel) => void; onClose: () => void }) {
  useLocale();
  const [p, setP] = useState<Panel>(initial ? { ...initial } : blank());
  const errs = validatePanel(p);
  const set = <K extends keyof Panel>(k: K, v: Panel[K]) => setP((x) => ({ ...x, [k]: v }));
  const txt = (k: keyof Panel, label: string) => (
    <Field label={translateValue(label)}><input className={inputCls} value={(p[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} /></Field>
  );
  const num = (k: keyof Panel, label: string) => (
    <Field label={translateValue(label)}><Num value={p[k] as number | undefined} onChange={(v) => set(k, v as never)} min={0} /></Field>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-extrabold">{translateValue(initial ? "Editar panel" : "Crear panel personalizado")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {translateValue(txt("name", "Nombre *"))}{translateValue(txt("brand", "Marca"))}{translateValue(txt("model", "Modelo"))}
          <Field label={t("Uso")}>
            <select className={inputCls} value={p.usage} onChange={(e) => set("usage", e.target.value as Usage)}>
              {["indoor", "outdoor", "rental", "instalacion", "piso", "transparente"].map((u) => <option key={u}>{translateValue(u)}</option>)}
            </select>
          </Field>
          {translateValue(num("widthMm", "Ancho mm *"))}{translateValue(num("heightMm", "Alto mm *"))}{translateValue(num("resX", "Píxeles H *"))}{translateValue(num("resY", "Píxeles V *"))}
          {translateValue(txt("pitchName", "Pitch comercial"))}{translateValue(txt("family", "Familia compatible"))}
          <Field label={t("Familia confirmada")}>
            <select className={inputCls} value={p.familyConfirmed ? "si" : "no"} onChange={(e) => set("familyConfirmed", e.target.value === "si")}><option value="no">{t("No")}</option><option value="si">{t("Sí")}</option></select>
          </Field>
          <Field label={t("Montaje admitido")}>
            <select className={inputCls} value={p.orientations.join(",")} onChange={(e) => set("orientations", e.target.value.split(",") as Panel["orientations"])}>
              <option value="vertical">{t("Vertical")}</option><option value="horizontal">{t("Horizontal")}</option><option value="vertical,horizontal">{t("Ambos")}</option>
            </select>
          </Field>
          {translateValue(num("weightKg", "Peso kg"))}{translateValue(num("powerMaxW", "Consumo máx. W"))}{translateValue(num("powerAvgW", "Consumo prom. W"))}{translateValue(num("perCase", "Por flight case"))}
          {translateValue(num("moduleWmm", "Módulo ancho mm"))}{translateValue(num("moduleHmm", "Módulo alto mm"))}{translateValue(num("moduleResX", "Módulo px H"))}{translateValue(num("moduleResY", "Módulo px V"))}
          <Field label={t("Admite curvatura")}>
            <select className={inputCls} value={p.curvable ? "si" : "no"} onChange={(e) => set("curvable", e.target.value === "si")}><option value="no">{t("No")}</option><option value="si">{t("Sí")}</option></select>
          </Field>
          <Field label={t("Construcción")}>
            <select className={inputCls} value={p.construction} onChange={(e) => set("construction", e.target.value as Panel["construction"])}><option value="rigida">{t("Rígida articulada")}</option><option value="flexible">{t("Flexible")}</option></select>
          </Field>
          {translateValue(num("angleMinDeg", "Ángulo mín °"))}{translateValue(num("angleMaxDeg", "Ángulo máx °"))}{translateValue(num("angleStepDeg", "Incremento °"))}{translateValue(num("minRadiusMm", "Radio mín mm"))}
          {translateValue(txt("source", "Fuente de especificaciones"))}
          <Field label={t("Observaciones")} className="col-span-2 sm:col-span-3"><input className={inputCls} value={p.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        {p.widthMm > 0 && p.resX > 0 && <p className="mt-3 text-xs text-muted-foreground">{t("Pitch real:")} {translateValue((p.widthMm / p.resX).toFixed(3))} × {translateValue((p.heightMm / p.resY).toFixed(3))} {t("mm")}</p>}
        <div className="mt-3 space-y-1">{errs.map((e) => <Notice key={e} kind="error">{translateValue(e)}</Notice>)}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>{t("Cancelar")}</Btn>
          <Btn disabled={errs.some((e) => !e.startsWith("El pitch comercial"))} onClick={() => onSave({ ...p, custom: true, generic: false, category: "custom" })}>{t("Guardar panel")}</Btn>
        </div>
      </div>
    </div>
  );
}
