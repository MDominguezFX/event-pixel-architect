// Store del proyecto con deshacer/rehacer y autoguardado local.
import { useSyncExternalStore } from "react";
import { BUILTIN_PANELS, type Panel } from "./catalog";
import { newProject, type Project } from "./model";
import { currentId, loadAll, loadPanels, saveProject, savePanels } from "./persistence";

interface State { project: Project; past: Project[]; future: Project[]; customPanels: Panel[]; ready: boolean }
let state: State = { project: newProject(BUILTIN_PANELS[6]!), past: [], future: [], customPanels: [], ready: false };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let saveT: ReturnType<typeof setTimeout> | undefined;

export function initStore() {
  if (state.ready) return;
  const all = loadAll(), id = currentId();
  const p = (id && all[id]) || Object.values(all)[0];
  state = { ...state, project: p ?? state.project, customPanels: loadPanels(), ready: true };
  emit();
}

function persist() {
  clearTimeout(saveT);
  saveT = setTimeout(() => saveProject(state.project), 400);
}

export function update(fn: (p: Project) => Project, history = true) {
  const next = { ...fn(structuredClone(state.project)), updatedAt: new Date().toISOString() };
  state = { ...state, project: next, past: history ? [...state.past.slice(-80), state.project] : state.past, future: history ? [] : state.future };
  persist(); emit();
}
export function setProject(p: Project) { state = { ...state, project: p, past: [], future: [] }; saveProject(p); emit(); }
export function undo() { const prev = state.past.at(-1); if (!prev) return; state = { ...state, project: prev, past: state.past.slice(0, -1), future: [state.project, ...state.future] }; persist(); emit(); }
export function redo() { const n = state.future[0]; if (!n) return; state = { ...state, project: n, past: [...state.past, state.project], future: state.future.slice(1) }; persist(); emit(); }
export function setCustomPanels(p: Panel[]) { state = { ...state, customPanels: p }; savePanels(p); emit(); }

export function useStore() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);
}

export function allPanels(s: State): Panel[] {
  const map = new Map<string, Panel>();
  for (const p of [...BUILTIN_PANELS, ...s.customPanels, ...s.project.customPanels]) map.set(p.id, p);
  return [...map.values()];
}
