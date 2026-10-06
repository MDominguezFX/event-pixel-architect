// Catálogo genérico editable. Separado del editor: los datos viven aquí y los
// paneles custom se guardan en localStorage (ver persistence.ts).
// Los presets son GENÉRICOS: no corresponden a ninguna marca ni ranking.

export type Usage = "indoor" | "outdoor" | "rental" | "instalacion" | "piso" | "transparente";
export type Orientation = "vertical" | "horizontal";

export interface Panel {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  usage: Usage;
  category: string; // familia del catálogo: rental-500, touring, xr, piso...
  widthMm: number;
  heightMm: number;
  resX: number;
  resY: number;
  pitchName?: string;
  family?: string; // familia de compatibilidad mecánica (si está vacía, no se asume nada)
  familyConfirmed?: boolean; // compatibilidad mecánica confirmada por catálogo/usuario
  orientations: Orientation[];
  weightKg?: number;
  powerMaxW?: number;
  powerAvgW?: number;
  perCase?: number;
  moduleWmm?: number;
  moduleHmm?: number;
  moduleResX?: number;
  moduleResY?: number;
  curvable: boolean;
  construction: "rigida" | "flexible";
  angleMinDeg?: number;
  angleMaxDeg?: number;
  angleStepDeg?: number;
  minRadiusMm?: number;
  source?: string;
  notes?: string;
  generic: boolean;
  custom: boolean;
}

function g(
  id: string,
  cat: string,
  usage: Usage,
  w: number,
  h: number,
  pitch: string,
  rx: number,
  ry: number,
): Panel {
  return {
    id,
    name: `Genérico ${w}×${h} ${pitch}`,
    usage,
    category: cat,
    widthMm: w,
    heightMm: h,
    resX: rx,
    resY: ry,
    pitchName: pitch,
    family: cat.startsWith("rental") ? `generico-rental-${pitch}` : undefined,
    familyConfirmed: false,
    orientations: ["vertical"],
    curvable: false,
    construction: "rigida",
    generic: true,
    custom: false,
    source: "Preset genérico (no corresponde a una ficha oficial)",
  };
}

export const CATEGORIES: { id: string; label: string }[] = [
  { id: "rental-500x500", label: "Rental 500 × 500 mm" },
  { id: "rental-500x1000", label: "Rental 500 × 1000 mm" },
  { id: "inst-640x480", label: "Instalación 640 × 480 mm" },
  { id: "inst-960x960", label: "Instalación 960 × 960 mm" },
  // Familias preparadas para cargar modelos con ficha oficial:
  { id: "touring", label: "Touring" },
  { id: "broadcast", label: "Broadcast" },
  { id: "xr", label: "XR" },
  { id: "piso", label: "Pisos LED" },
  { id: "transparente", label: "Transparentes" },
  { id: "custom", label: "Personalizados" },
];

export const BUILTIN_PANELS: Panel[] = [
  g("r500-p26", "rental-500x500", "rental", 500, 500, "P2.6", 192, 192),
  g("r500-p29", "rental-500x500", "rental", 500, 500, "P2.9", 168, 168),
  g("r500-p39", "rental-500x500", "rental", 500, 500, "P3.9", 128, 128),
  g("r500-p48", "rental-500x500", "rental", 500, 500, "P4.8", 104, 104),
  g("r1000-p26", "rental-500x1000", "rental", 500, 1000, "P2.6", 192, 384),
  g("r1000-p29", "rental-500x1000", "rental", 500, 1000, "P2.9", 168, 336),
  g("r1000-p39", "rental-500x1000", "rental", 500, 1000, "P3.9", 128, 256),
  g("r1000-p48", "rental-500x1000", "rental", 500, 1000, "P4.8", 104, 208),
  g("i640-p25", "inst-640x480", "instalacion", 640, 480, "P2.5", 256, 192),
  g("i640-p4", "inst-640x480", "instalacion", 640, 480, "P4", 160, 120),
  g("i960-p4", "inst-960x960", "instalacion", 960, 960, "P4", 240, 240),
  g("i960-p5", "inst-960x960", "instalacion", 960, 960, "P5", 192, 192),
  g("i960-p667", "inst-960x960", "instalacion", 960, 960, "P6.67", 144, 144),
  g("i960-p8", "inst-960x960", "instalacion", 960, 960, "P8", 120, 120),
  g("i960-p10", "inst-960x960", "instalacion", 960, 960, "P10", 96, 96),
];

export const realPitch = (p: Panel) => ({ x: p.widthMm / p.resX, y: p.heightMm / p.resY });

export function validatePanel(p: Partial<Panel>): string[] {
  const e: string[] = [];
  if (!p.name?.trim()) e.push("El nombre es obligatorio.");
  for (const k of ["widthMm", "heightMm"] as const)
    if (!(Number(p[k]) > 0)) e.push(`${k === "widthMm" ? "Ancho" : "Alto"} debe ser positivo.`);
  for (const k of ["resX", "resY"] as const)
    if (!(Number(p[k]) > 0) || !Number.isInteger(Number(p[k])))
      e.push(`Resolución ${k === "resX" ? "horizontal" : "vertical"} debe ser un entero positivo.`);
  if (e.length === 0 && p.widthMm && p.heightMm && p.resX && p.resY) {
    const px = p.widthMm / p.resX, py = p.heightMm / p.resY;
    if (Math.abs(px - py) / px > 0.02)
      e.push(`Pitch horizontal (${px.toFixed(3)} mm) y vertical (${py.toFixed(3)} mm) no coinciden.`);
    const nominal = p.pitchName ? parseFloat(p.pitchName.replace(/[^\d.]/g, "")) : NaN;
    if (!isNaN(nominal) && Math.abs(nominal - px) / px > 0.1)
      e.push(`El pitch comercial (${p.pitchName}) difiere más de 10% del real (${px.toFixed(2)} mm).`);
  }
  for (const k of ["weightKg", "powerMaxW", "powerAvgW", "perCase", "angleMinDeg", "angleMaxDeg", "angleStepDeg", "minRadiusMm"] as const) {
    const v = p[k];
    if (v !== undefined && v !== null && !(Number(v) >= 0)) e.push(`${k} no puede ser negativo.`);
  }
  if (p.angleMinDeg !== undefined && p.angleMaxDeg !== undefined && p.angleMinDeg > p.angleMaxDeg)
    e.push("El ángulo mínimo supera al máximo.");
  if (p.perCase !== undefined && !Number.isInteger(p.perCase)) e.push("Cantidad por case debe ser entera.");
  return e;
}
