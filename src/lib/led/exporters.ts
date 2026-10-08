// Exportadores PNG (canvas), PDF (jsPDF vectorial), JSON y CSV. Todo local en el navegador.
import { jsPDF } from "jspdf";
import { realPitch } from "./catalog";
import { screenStats, fmtM, type PanelLookup } from "./engine";
import { computeCurve } from "./geometry";
import { slicesCsv } from "./mapping";
import type { Project, Screen } from "./model";
import { frontPlan, layoutPlan, topPlan, wiringPlan, type Plan, type Prim } from "./plan";

export function download(name: string, data: Blob | string, mime = "application/octet-stream") {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const safe = (s: string) => s.replace(/[^\w\-]+/g, "_").slice(0, 60) || "proyecto";

// ---------- PNG ----------
export interface PngOpts { bg: "blanco" | "oscuro" | "transparente"; dims: boolean; numbers: boolean; width: number; view: "frontal" | "superior" | "ambas"; wiring?: boolean }

function drawCanvas(ctx: CanvasRenderingContext2D, plan: Plan, box: { x: number; y: number; w: number; h: number }) {
  const pw = plan.maxX - plan.minX, ph = plan.maxY - plan.minY;
  const k = Math.min(box.w / pw, box.h / ph);
  const ox = box.x + (box.w - pw * k) / 2 - plan.minX * k, oy = box.y + (box.h - ph * k) / 2 - plan.minY * k;
  const X = (x: number) => ox + x * k, Y = (y: number) => oy + y * k;
  for (const p of plan.prims) {
    if (p.t === "rect") {
      if (p.fill) { ctx.fillStyle = p.fill; ctx.fillRect(X(p.x), Y(p.y), p.w * k, p.h * k); }
      if (p.hatch) {
        ctx.save(); ctx.beginPath(); ctx.rect(X(p.x), Y(p.y), p.w * k, p.h * k); ctx.clip();
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = Math.max(1, p.w * k / 40);
        const step = Math.max(6, p.w * k / 8);
        for (let d = -p.h * k; d < p.w * k; d += step) { ctx.beginPath(); ctx.moveTo(X(p.x) + d, Y(p.y) + p.h * k); ctx.lineTo(X(p.x) + d + p.h * k, Y(p.y)); ctx.stroke(); }
        ctx.restore();
      }
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = Math.max(0.5, (p.lw ?? 1) * k); ctx.strokeRect(X(p.x), Y(p.y), p.w * k, p.h * k); }
    } else if (p.t === "line") {
      ctx.strokeStyle = p.stroke; ctx.lineWidth = Math.max(0.5, p.lw * k);
      ctx.beginPath(); ctx.moveTo(X(p.x1), Y(p.y1)); ctx.lineTo(X(p.x2), Y(p.y2)); ctx.stroke();
    } else if (p.t === "poly") {
      ctx.strokeStyle = p.stroke; ctx.lineWidth = Math.max(1, p.lw * k);
      ctx.beginPath(); p.pts.forEach((q, i) => (i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y)))); if (p.closed) ctx.closePath(); ctx.stroke();
    } else {
      ctx.save(); ctx.fillStyle = p.color; ctx.font = `${p.bold ? "700" : "400"} ${Math.max(8, p.size * k)}px "Nunito Sans", sans-serif`;
      ctx.textAlign = p.align ?? "left"; ctx.translate(X(p.x), Y(p.y)); if (p.rot) ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillText(p.s, 0, 0); ctx.restore();
    }
  }
}

export async function exportPng(project: Project, screen: Screen, lookup: PanelLookup, o: PngOpts) {
  const dark = o.bg === "oscuro";
  const ink = dark ? "#E8F1FA" : "#0B1B2B";
  const po = { dims: o.dims, numbers: o.numbers, ink, muted: "#6b7c8f" };
  const plans: Plan[] = [];
  if (o.wiring) plans.push(wiringPlan(screen, lookup, po, project.screens.findIndex((s) => s.id === screen.id)));
  else if (o.view !== "superior") plans.push(frontPlan(screen, lookup, po));
  const tp = topPlan(screen, lookup, po);
  if (tp && o.view !== "frontal" && !o.wiring) plans.push(tp);
  if (!plans.length) plans.push(frontPlan(screen, lookup, po));
  const W = o.width, header = W * 0.06, footer = W * 0.03;
  const aspects = plans.map((p) => (p.maxY - p.minY) / (p.maxX - p.minX));
  const H = Math.round(header + footer + aspects.reduce((a, b) => a + b * W * 0.92, 0) + W * 0.04 * plans.length);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el plano PNG.");
  if (o.bg !== "transparente") { ctx.fillStyle = dark ? "#0B1420" : "#ffffff"; ctx.fillRect(0, 0, W, H); }
  await document.fonts?.ready;
  const st = screenStats(screen, lookup);
  ctx.fillStyle = ink; ctx.font = `800 ${W * 0.022}px "Nunito Sans", sans-serif`;
  ctx.fillText(`${project.name} — ${screen.name}${o.wiring ? " · Pixel Plot / Cableado" : ""}`, W * 0.04, header * 0.5, W * 0.92);
  ctx.font = `400 ${W * 0.013}px "Nunito Sans", sans-serif`;
  ctx.fillText(`${fmtM(st.widthMm)} × ${fmtM(st.heightMm)} · ${st.resX}×${st.resY} px · ${st.count} gabinetes · ${st.areaM2.toFixed(2)} m² · ${st.types.map((t) => t.panel.name).join(" + ")}`, W * 0.04, header * 0.85, W * 0.92);
  let y = header;
  plans.forEach((p, i) => { const h = aspects[i]! * W * 0.92; drawCanvas(ctx, p, { x: W * 0.04, y, w: W * 0.92, h }); y += h + W * 0.04; });
  ctx.fillStyle = "#189BEA"; ctx.font = `700 ${W * 0.011}px "Nunito Sans", sans-serif`; ctx.textAlign = "right";
  ctx.fillText("MANSSO PIXEL · MANSSO TIP / Start Solution", W * 0.96, H - footer * 0.4);
  const blob = await new Promise<Blob>((resolve, reject) => cv.toBlob((b) => b ? resolve(b) : reject(new Error("No se pudo generar el PNG.")), "image/png"));
  download(`${safe(project.name)}_${safe(screen.name)}${o.wiring ? "_cableado" : ""}.png`, blob);
}

// ---------- PDF ----------
export type PdfSection = "layout" | "frontal" | "cableado" | "superior" | "datos" | "slices";
export interface PdfOpts { size: "a4" | "a3"; orientation: "landscape" | "portrait"; wiring?: boolean; sections?: PdfSection[]; screenIds?: string[] }

/** Pages the PDF will contain for the given selection (same rules as exportPdf). */
export function pdfPageCount(project: Project, lookup: PanelLookup, o: PdfOpts, pro: boolean) {
  const sec = new Set(o.sections ?? ["layout", "frontal", "superior", "datos", "slices", ...(o.wiring ? ["cableado" as const] : [])]);
  const screens = project.screens.filter((s) => !o.screenIds || o.screenIds.includes(s.id));
  let n = sec.has("layout") && project.screens.length > 1 ? 1 : 0;
  for (const s of screens) n += (sec.has("frontal") ? 1 : 0) + (sec.has("cableado") ? 1 : 0) + (sec.has("datos") ? 1 : 0) + (sec.has("superior") && s.geometry.type !== "plana" && topPlan(s, lookup, { dims: true, numbers: true, ink: "#000", muted: "#000" }) ? 1 : 0);
  if (pro && sec.has("slices") && project.mapping.slices.length) n += Math.ceil(project.mapping.slices.length / 35);
  return n;
}

function hexRgb(h: string): [number, number, number] {
  const m = h.replace("#", ""); return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function drawPdf(doc: jsPDF, plan: Plan, box: { x: number; y: number; w: number; h: number }) {
  const pw = plan.maxX - plan.minX, ph = plan.maxY - plan.minY;
  const k = Math.min(box.w / pw, box.h / ph);
  const ox = box.x + (box.w - pw * k) / 2 - plan.minX * k, oy = box.y + (box.h - ph * k) / 2 - plan.minY * k;
  const X = (x: number) => ox + x * k, Y = (y: number) => oy + y * k;
  for (const p of plan.prims as Prim[]) {
    if (p.t === "rect") {
      if (p.fill) doc.setFillColor(...hexRgb(p.fill));
      if (p.stroke) { doc.setDrawColor(...hexRgb(p.stroke)); doc.setLineWidth(Math.max(0.05, (p.lw ?? 0) * k)); }
      doc.rect(X(p.x), Y(p.y), p.w * k, p.h * k, p.fill && p.stroke ? "FD" : p.fill ? "F" : "S");
      if (p.hatch) { doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.1); doc.line(X(p.x), Y(p.y + p.h), X(p.x + p.w), Y(p.y)); }
    } else if (p.t === "line") {
      doc.setDrawColor(...hexRgb(p.stroke)); doc.setLineWidth(Math.max(0.05, p.lw * k)); doc.line(X(p.x1), Y(p.y1), X(p.x2), Y(p.y2));
    } else if (p.t === "poly") {
      doc.setDrawColor(...hexRgb(p.stroke)); doc.setLineWidth(Math.max(0.2, p.lw * k));
      for (let i = 0; i < p.pts.length - 1; i++) doc.line(X(p.pts[i]!.x), Y(p.pts[i]!.y), X(p.pts[i + 1]!.x), Y(p.pts[i + 1]!.y));
    } else {
      doc.setTextColor(...hexRgb(p.color)); doc.setFont("helvetica", p.bold ? "bold" : "normal");
      doc.setFontSize(Math.max(4, (p.size * k) / 0.3528));
      if (p.rot) {
        // jsPDF ignora align con ángulo: centrar manualmente a lo largo del eje rotado.
        const tw = doc.getTextWidth(p.s);
        doc.text(p.s, X(p.x), Y(p.y) + (p.align === "center" ? tw / 2 : 0), { angle: -p.rot });
      } else doc.text(p.s, X(p.x), Y(p.y), { align: p.align ?? "left" });
    }
  }
}

export function exportPdf(project: Project, lookup: PanelLookup, o: PdfOpts, pro: boolean) {
  const doc = new jsPDF({ unit: "mm", format: o.size, orientation: o.orientation });
  const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
  const M = 12;
  const po = { dims: true, numbers: true, ink: "#0B1B2B", muted: "#6b7c8f" };
  let page = 0;
  const frame = (title: string) => {
    if (page++) doc.addPage();
    doc.setFillColor(1, 95, 191); doc.rect(0, 0, PW, 14, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("MANSSO PIXEL — LED Planner", M, 9);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`${project.name}${project.client ? " · " + project.client : ""} · Rev. ${project.revision} · ${new Date().toLocaleDateString("es-AR")}`, PW - M, 9, { align: "right" });
    doc.setTextColor(11, 27, 43); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(title, M, 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 110, 120);
    doc.text("Esquema sin escala · Documenta geometría y configuración. No valida estructura, rigging ni montaje mecánico.", M, PH - 6);
    doc.text(`MANSSO TIP / Una herramienta de Start Solution · pág. ${page}`, PW - M, PH - 6, { align: "right" });
  };
  const box = { x: M, y: 26, w: PW - 2 * M, h: PH - 40 };
  const sec = new Set(o.sections ?? ["layout", "frontal", "superior", "datos", "slices", ...(o.wiring ? ["cableado" as const] : [])]);
  const screens = project.screens.filter((s) => !o.screenIds || o.screenIds.includes(s.id));

  if (sec.has("layout") && project.screens.length > 1) { frame("Layout general"); drawPdf(doc, layoutPlan(project, lookup, po), box); }
  for (const s of screens) {
    if (sec.has("frontal")) { frame(`${s.name} — plano frontal desarrollado`); drawPdf(doc, frontPlan(s, lookup, po), box); }
    if (sec.has("cableado")) { frame(`${s.name} — Pixel Plot / Cableado de datos`); drawPdf(doc, wiringPlan(s, lookup, po, project.screens.indexOf(s)), box); }
    const tp = topPlan(s, lookup, po);
    if (tp && sec.has("superior")) { frame(`${s.name} — vista superior`); drawPdf(doc, tp, box); }
    if (!sec.has("datos")) continue;
    // Tabla de equipamiento
    frame(`${s.name} — datos y equipamiento`);
    const st = screenStats(s, lookup);
    const nd = (v: number | null, u: string) => (v == null ? "Sin datos" : `${v.toLocaleString("es-AR")} ${u}`);
    const rows: string[][] = [
      ["Medidas", `${fmtM(st.widthMm)} × ${fmtM(st.heightMm)}`], ["Superficie LED", `${st.areaM2.toFixed(3)} m²`],
      ["Envolvente", `${st.envelopeM2.toFixed(3)} m²`], ["Resolución canvas", `${st.resX} × ${st.resY} px`],
      ["Píxeles activos", st.activePixels.toLocaleString("es-AR")], ["Relación", `${st.aspectLabel} (${st.diff169Pct >= 0 ? "+" : ""}${st.diff169Pct.toFixed(2)}% vs 16:9)`],
      ["Gabinetes", String(st.count)], ["Peso total", nd(st.weightKg, "kg")], ["Consumo máx.", nd(st.powerMaxW, "W")], ["Consumo prom.", nd(st.powerAvgW, "W")],
    ];
    if (s.geometry.type !== "plana") {
      const first = lookup(s.cabinets[0]!.panelId)!;
      const cols = s.cabinets.filter((c) => c.y === s.cabinets[0]!.y).length;
      const cr = computeCurve(s.geometry, cols, s.cabinets[0]!.rotated ? first.heightMm : first.widthMm, first);
      rows.push(["Geometría", `${s.geometry.type} · ${cr.faceted ? "facetada" : "continua"}`], ["Apertura", `${cr.apertureDeg.toFixed(2)}°`],
        ["Radio", cr.radiusMm ? `${fmtM(cr.radiusMm)} (${cr.radiusRef})` : "-"], ["Frente / profundidad", `${fmtM(cr.frontWidthMm)} / ${fmtM(cr.depthMm)}`]);
      if (cr.warnings.length || cr.errors.length) rows.push(["Avisos", [...cr.errors, ...cr.warnings].join(" ")]);
    }
    let y = 30;
    doc.setFontSize(9);
    for (const [a, b] of rows) { doc.setFont("helvetica", "bold"); doc.text(a!, M, y); doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(b!, PW / 2 - 50), M + 40, y); y += 6; }
    y += 4; doc.setFont("helvetica", "bold"); doc.text("Tipo · Cant. · Medida · Resolución · Pitch real · Peso · Consumo máx. · Cases", M, y); y += 6; doc.setFont("helvetica", "normal");
    for (const t of st.types) {
      doc.text(`${t.panel.name}${t.rotated ? " (girado)" : ""} · ${t.count} · ${t.panel.widthMm}×${t.panel.heightMm} mm · ${t.panel.resX}×${t.panel.resY} px · ${realPitch(t.panel).x.toFixed(3)} mm · ${nd(t.weightKg, "kg")} · ${nd(t.powerMaxW, "W")} · ${t.cases ?? "Sin datos"}`, M, y);
      y += 6;
    }
  }
  if (pro && sec.has("slices") && project.mapping.slices.length) {
    frame("Mapa de slices (canvas → salida)");
    doc.setFontSize(8);
    let y = 30;
    doc.text(`Canvas ${project.mapping.canvasW}×${project.mapping.canvasH} px · Salidas: ${project.mapping.outputs.map((o) => `${o.name} ${o.w}×${o.h}`).join(", ")} · Coordenadas enteras, origen arriba-izquierda`, M, y); y += 7;
    doc.setFont("helvetica", "bold"); doc.text("Nombre · Entrada (x,y,w,h) · Salida · (x,y,w,h)", M, y); doc.setFont("helvetica", "normal"); y += 5;
    for (const s of project.mapping.slices) {
      if (y > PH - 14) { frame("Mapa de slices (cont.)"); y = 30; doc.setFontSize(8); }
      doc.text(`${s.name} · ${s.input.x},${s.input.y},${s.input.w},${s.input.h} · ${project.mapping.outputs[s.outputIndex]?.name ?? "?"} · ${s.output.x},${s.output.y},${s.output.w},${s.output.h}${s.rotation ? ` · rot ${s.rotation}°` : ""}`, M, y); y += 4.5;
    }
  }
  if (!page) frame("Sin secciones seleccionadas");
  doc.save(`${safe(project.name)}_rev${safe(project.revision)}.pdf`);
}

export const exportJson = (p: Project) => download(`${safe(p.name)}.mansso.json`, JSON.stringify(p, null, 2), "application/json");
export const exportCsv = (p: Project) => download(`${safe(p.name)}_slices.csv`, slicesCsv(p), "text/csv");
export const exportSlicesJson = (p: Project) => download(`${safe(p.name)}_slices.json`, JSON.stringify(p.mapping, null, 2), "application/json");
