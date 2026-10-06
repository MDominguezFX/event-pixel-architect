// Exportación a Resolume Arena basada EXCLUSIVAMENTE en una plantilla real.
// No se inventa el esquema: se clona un elemento <Slice> existente del preset
// importado y sólo se modifican nombre y rectángulos donde la estructura es reconocible.
// Estado: validación automática de estructura. NO verificado abriéndolo en Arena.
import type { Project } from "./model";

export interface TemplateInfo {
  ok: boolean;
  errors: string[];
  notes: string[];
  rootName?: string;
  version?: string;
  sliceCount: number;
  xml?: string;
}

export function analyzeTemplate(xml: string): TemplateInfo {
  const errors: string[] = [], notes: string[] = [];
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return { ok: false, errors: ["El archivo contiene DOCTYPE/entidades: rechazado por seguridad."], notes, sliceCount: 0 };
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return { ok: false, errors: ["XML mal formado."], notes, sliceCount: 0 };
  const root = doc.documentElement;
  const slices = doc.getElementsByTagName("Slice");
  const version = root.getAttribute("version") ?? root.getAttribute("appVersion") ?? doc.querySelector("[version]")?.getAttribute("version") ?? undefined;
  if (!slices.length) errors.push("No se encontró ningún elemento <Slice>: exporte desde Arena un preset de Advanced Output con al menos un slice.");
  const s0 = slices[0];
  if (s0) {
    if (!s0.querySelector("InputRect, inputRect")) notes.push("El slice de plantilla no tiene InputRect reconocible: no se modificará la entrada.");
    if (!s0.querySelector("OutputRect, outputRect")) notes.push("El slice de plantilla no tiene OutputRect reconocible: no se modificará la salida.");
  }
  notes.push("Funciones no interpretadas (máscaras, warping, soft edge, efectos) se copian tal cual desde la plantilla.");
  return { ok: errors.length === 0, errors, notes, rootName: root.nodeName, version, sliceCount: slices.length, xml };
}

function setRect(el: Element | null, r: { x: number; y: number; w: number; h: number }) {
  if (!el) return;
  const vs = el.getElementsByTagName("v");
  if (vs.length === 4) {
    const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    for (let i = 0; i < 4; i++) { vs[i]!.setAttribute("x", String(pts[i]![0])); vs[i]!.setAttribute("y", String(pts[i]![1])); }
  }
}

/** Genera XML a partir de la plantilla, sin modificar el original. */
export function exportArenaXml(tpl: TemplateInfo, p: Project): string {
  if (!tpl.ok || !tpl.xml) throw new Error("No hay plantilla válida de Arena.");
  const doc = new DOMParser().parseFromString(tpl.xml, "application/xml");
  const slices = Array.from(doc.getElementsByTagName("Slice"));
  const proto = slices[0]!;
  const parent = proto.parentNode!;
  slices.forEach((s) => s.parentNode?.removeChild(s));
  for (const s of p.mapping.slices) {
    const el = proto.cloneNode(true) as Element;
    if (el.hasAttribute("name")) el.setAttribute("name", s.name);
    const nameParam = Array.from(el.getElementsByTagName("Param")).find((x) => x.getAttribute("name") === "Name");
    if (nameParam) nameParam.setAttribute("value", s.name);
    if (el.hasAttribute("uniqueId")) el.setAttribute("uniqueId", String(Date.now() + Math.floor(Math.random() * 1e6)));
    setRect(el.querySelector("InputRect, inputRect"), s.input);
    setRect(el.querySelector("OutputRect, outputRect"), s.output);
    parent.appendChild(el);
  }
  return new XMLSerializer().serializeToString(doc);
}
