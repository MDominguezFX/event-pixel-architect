// Exportación a Resolume Arena basada EXCLUSIVAMENTE en una plantilla real.
// No se inventa el esquema: se clona un elemento <Slice> existente del preset
// importado y sólo se modifican nombre y rectángulos donde la estructura es reconocible.
// Estado: validación automática de estructura. NO verificado abriéndolo en Arena.
import type { Project, Slice } from "./model";
import { outputQuad } from "./mapping";

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

const rectPts = (r: { x: number; y: number; w: number; h: number }) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];

function setRect(el: Element | null, pts: { x: number; y: number }[]) {
  if (!el) return;
  const vs = el.getElementsByTagName("v");
  if (vs.length === 4) for (let i = 0; i < 4; i++) { vs[i]!.setAttribute("x", String(pts[i]!.x)); vs[i]!.setAttribute("y", String(pts[i]!.y)); }
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
    setRect(el.querySelector("InputRect, inputRect"), rectPts(s.input));
    setRect(el.querySelector("OutputRect, outputRect"), outputQuad(s));
    parent.appendChild(el);
  }
  return new XMLSerializer().serializeToString(doc);
}

// ---------------------------------------------------------------------------
// Generación SIN plantilla: estructura de Advanced Output de Arena 7.x según
// presets públicos conocidos. Estado: NO verificado en Arena. Si se importa un
// preset real, se usa exportArenaXml (preferido).
export const ARENA_TARGET = "Resolume Arena 7.x (Advanced Output)";
const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const vtx = (pts: { x: number; y: number }[], pad: string) => pts.map((q) => `${pad}<v x="${q.x}" y="${q.y}"/>`).join("\n");

function sliceXml(s: Slice, id: number) {
  return `        <Slice uniqueId="${id}">
          <Params name="Common">
            <Param name="Name" T="STRING" default="Layer" value="${esc(s.name)}"/>
            <Param name="Enabled" T="BOOL" default="1" value="1"/>
          </Params>
          <Params name="Input">
            <ParamChoice name="Input Source" default="0:1" value="0:1" storeChoices="0"/>
            <Param name="Input Opacity" T="BOOL" default="1" value="1"/>
            <Param name="Input Bypass/Solo" T="BOOL" default="1" value="1"/>
          </Params>
          <Params name="Output">
            <Param name="Flip" T="UINT8" default="0" value="0"/>
          </Params>
          <InputRect orientation="0">
${vtx(rectPts(s.input), "            ")}
          </InputRect>
          <OutputRect orientation="0">
${vtx(outputQuad(s), "            ")}
          </OutputRect>
          <Warper>
            <Params name="Warper"><Param name="Point Mode" T="UINT8" default="0" value="0"/></Params>
            <BezierWarper controlWidth="4" controlHeight="4"/>
          </Warper>
        </Slice>`;
}

/** Arena Advanced Output preset generated from the project mapping (one Screen per output). */
export function generateArenaXml(p: Project): string {
  const m = p.mapping;
  let id = Date.now();
  const screens = m.outputs.map((o, oi) => {
    const slices = m.slices.filter((s) => s.outputIndex === oi);
    return `    <Screen name="${esc(o.name)}" uniqueId="${id++}">
      <Params name="Params">
        <Param name="Name" T="STRING" default="" value="${esc(o.name)}"/>
        <Param name="Enabled" T="BOOL" default="1" value="1"/>
        <Param name="Hidden" T="BOOL" default="0" value="0"/>
      </Params>
      <guides>
        <ScreenGuide name="ScreenGuide" type="0"><Params name="Params"><Param name="Opacity" T="DOUBLE" default="0.25" value="0.25"/></Params></ScreenGuide>
        <ScreenGuide name="ScreenGuide" type="1"><Params name="Params"><Param name="Opacity" T="DOUBLE" default="0.25" value="0.25"/></Params></ScreenGuide>
      </guides>
      <layers>
${slices.map((s) => sliceXml(s, id++)).join("\n")}
      </layers>
      <OutputDevice>
        <OutputDeviceVirtual name="${esc(o.name)}" deviceId="VirtualScreen ${oi + 1}" idHash="${id++}" width="${o.w}" height="${o.h}">
          <Params name="Params">
            <ParamRange name="Width" T="DOUBLE" default="1920" value="${o.w}"><DurationSource defaultMillisecondsDuration="1000"/></ParamRange>
            <ParamRange name="Height" T="DOUBLE" default="1080" value="${o.h}"><DurationSource defaultMillisecondsDuration="1000"/></ParamRange>
          </Params>
        </OutputDeviceVirtual>
      </OutputDevice>
    </Screen>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- MANSSO PIXEL · ${esc(p.name)} · generado sin plantilla para ${ARENA_TARGET}. No verificado en Arena: confirmar al cargar. Salidas virtuales: reasignar a monitores físicos en cada computadora. -->
<XmlState name="${esc(p.name)}">
  <versionInfo name="Resolume Arena" majorVersion="7" minorVersion="0" microVersion="0" revision="0"/>
  <ScreenSetup name="ScreenSetup">
    <Params name="ScreenSetupParams"/>
    <CurrentCompositionTextureSize width="${m.canvasW}" height="${m.canvasH}"/>
    <screens>
${screens.join("\n")}
    </screens>
    <SoftEdging><Params name="Soft Edge"><Param name="Gamma Red" T="DOUBLE" default="2" value="2"/></Params></SoftEdging>
  </ScreenSetup>
</XmlState>
`;
}
