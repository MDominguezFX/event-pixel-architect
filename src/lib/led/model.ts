// Modelo único del proyecto: lo usan cálculos, plano, materiales y exportadores.
import type { Panel } from "./catalog";

export const SCHEMA_VERSION = 1;

export type GeometryType = "plana" | "concava" | "convexa" | "arco" | "cilindro";
export type CurveMode = "facetada" | "continua";
export type NumberOrder = "filas" | "columnas" | "serpentina";
export type Corner = "tl" | "tr" | "bl" | "br";
export type ScreenKind = "principal" | "lateral" | "totem" | "banner" | "cabina" | "arco" | "libre";

/** Gabinete colocado en la vista frontal desarrollada. x,y en mm desde la esquina superior izquierda. */
export interface Cabinet {
  id: string;
  panelId: string;
  x: number;
  y: number;
  rotated: boolean; // girado 90°: intercambia medidas y resolución
  angleDeg?: number; // giro libre adicional (esquema), sobre el centro del gabinete; no altera píxeles
}

export interface Geometry {
  type: GeometryType;
  mode: CurveMode;
  angleDeg: number; // ángulo entre gabinetes rígidos (facetada)
  radiusMm: number; // radio (continua)
  input: "angulo" | "radio" | "apertura";
  apertureDeg: number;
  seamAfterColumn: number; // cilindro: unión entre la última y la primera columna
}

export interface Screen {
  id: string;
  name: string;
  kind: ScreenKind;
  cabinets: Cabinet[];
  geometry: Geometry;
  x: number; // posición en el layout general (mm), respecto del origen
  y: number;
  numbering: { order: NumberOrder; start: Corner };
  mixConfirmed: boolean; // usuario confirma compatibilidad mecánica de la mezcla
  mount?: "pared" | "techo"; // techo: la pantalla se dibuja horizontal en la vista 3D (esquemático)
  mountTiltDeg?: number; // inclinación de montaje de toda la pantalla (0 = vertical/pared, 90 = techo horizontal); esquemático, no cambia píxeles
  manualRuns?: string[][]; // cableado manual: ids de gabinetes por puerto, en orden de conexión
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Slice {
  id: string;
  name: string;
  screenId?: string;
  input: Rect;
  output: Rect;
  outputIndex: number;
  /** Rotación horaria en la salida, en grados (admite parciales). output es la caja sin rotar; gira sobre su centro. */
  rotation?: number;
}
export interface Mapping {
  canvasW: number;
  canvasH: number;
  outputs: { name: string; w: number; h: number }[];
  slices: Slice[];
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  client?: string;
  revision: string;
  createdAt: string;
  updatedAt: string;
  screens: Screen[];
  customPanels: Panel[];
  mapping: Mapping;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultGeometry = (): Geometry => ({
  type: "plana",
  mode: "facetada",
  angleDeg: 5,
  radiusMm: 5000,
  input: "angulo",
  apertureDeg: 90,
  seamAfterColumn: 0,
});

export function uniformCabinets(panel: Panel, cols: number, rows: number, rotated = false): Cabinet[] {
  const w = rotated ? panel.heightMm : panel.widthMm;
  const h = rotated ? panel.widthMm : panel.heightMm;
  const out: Cabinet[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out.push({ id: uid(), panelId: panel.id, x: c * w, y: r * h, rotated });
  return out;
}

export function newScreen(panel: Panel, name = "Pantalla principal", cols = 8, rows = 4): Screen {
  return {
    id: uid(),
    name,
    kind: "principal",
    cabinets: uniformCabinets(panel, cols, rows),
    geometry: defaultGeometry(),
    x: 0,
    y: 0,
    numbering: { order: "serpentina", start: "bl" },
    mixConfirmed: false,
  };
}

export function newProject(panel: Panel): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid(),
    name: "Proyecto sin título",
    revision: "A",
    createdAt: now,
    updatedAt: now,
    screens: [newScreen(panel)],
    customPanels: [],
    mapping: { canvasW: 1920, canvasH: 1080, outputs: [{ name: "Salida 1", w: 1920, h: 1080 }], slices: [] },
  };
}
