// Persistencia local (localStorage) e importación/validación de JSON.
import type { Panel } from "./catalog";
import { SCHEMA_VERSION, type Project } from "./model";

const KEY_PROJECTS = "mansso.projects.v1";
const KEY_CURRENT = "mansso.current.v1";
const KEY_PANELS = "mansso.customPanels.v1";

export function loadAll(): Record<string, Project> {
  try { return JSON.parse(localStorage.getItem(KEY_PROJECTS) ?? "{}"); } catch { return {}; }
}
export function saveProject(p: Project) {
  const all = loadAll(); all[p.id] = p;
  localStorage.setItem(KEY_PROJECTS, JSON.stringify(all));
  localStorage.setItem(KEY_CURRENT, p.id);
}
export function deleteProject(id: string) { const all = loadAll(); delete all[id]; localStorage.setItem(KEY_PROJECTS, JSON.stringify(all)); }
export function currentId() { return localStorage.getItem(KEY_CURRENT); }
export function loadPanels(): Panel[] { try { return JSON.parse(localStorage.getItem(KEY_PANELS) ?? "[]"); } catch { return []; } }
export function savePanels(p: Panel[]) { localStorage.setItem(KEY_PANELS, JSON.stringify(p)); }

export function validateProject(raw: unknown): { project?: Project; errors: string[] } {
  const e: string[] = [];
  const p = raw as Project;
  if (!p || typeof p !== "object") return { errors: ["El archivo no contiene un objeto JSON."] };
  if (typeof p.schemaVersion !== "number") e.push("Falta schemaVersion: no es un proyecto MANSSO PIXEL.");
  else if (p.schemaVersion > SCHEMA_VERSION) e.push(`Versión de esquema ${p.schemaVersion} más nueva que la soportada (${SCHEMA_VERSION}).`);
  if (!Array.isArray(p.screens)) e.push("Falta la lista de pantallas.");
  else p.screens.forEach((s, i) => { if (!Array.isArray(s.cabinets)) e.push(`Pantalla ${i + 1} sin gabinetes.`); });
  if (!Array.isArray(p.customPanels)) e.push("Falta customPanels.");
  if (!p.mapping) e.push("Falta el mapeo.");
  return e.length ? { errors: e } : { project: p, errors: [] };
}
