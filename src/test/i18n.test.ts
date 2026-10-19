import { afterEach, describe, expect, it } from "vitest";
import { currentLocale, detectLocale, LANGUAGE_KEY, setLocale, t } from "@/lib/i18n/core";
import { BUILTIN_PANELS } from "@/lib/led/catalog";
import { newProject } from "@/lib/led/model";
import { scene3d } from "@/lib/led/scene3d";
import { screenStats } from "@/lib/led/engine";

afterEach(async () => { await setLocale("es"); localStorage.clear(); });
describe("language preferences", () => {
  it("translates technical drawing messages without changing names, brands or pixel values", async () => {
    await setLocale("en");
    expect(t("Pantalla principal: 32 gabinetes · 16.00 m² · 1024×1024 px (1.048.576 px activos)")).toBe("Pantalla principal: 32 cabinets · 16.00 m² · 1024×1024 px (1.048.576 active px)");
    expect(t("MANSSO PIXEL")).toBe("MANSSO PIXEL");
    await setLocale("pt-BR");
    expect(t("Pantalla principal: 32 gabinetes · 16.00 m² · 1024×1024 px (1.048.576 px activos)")).toBe("Pantalla principal: 32 gabinetes · 16.00 m² · 1024×1024 px (1.048.576 px ativos)");
  });
  it("supports ES, EN and Brazilian Portuguese browser preferences", () => {
    expect(detectLocale(null, ["es-AR"])).toBe("es");
    expect(detectLocale(null, ["en-US"])).toBe("en");
    expect(detectLocale(null, ["pt-BR"])).toBe("pt-BR");
  });
  it("uses Spanish for unavailable languages", () => {
    expect(detectLocale(null, ["fr-FR", "de-DE"])).toBe("es");
  });
  it("prioritizes the user's saved selection", () => {
    localStorage.setItem(LANGUAGE_KEY, "pt-BR");
    expect(detectLocale(localStorage.getItem(LANGUAGE_KEY), ["en-US"])).toBe("pt-BR");
  });
  it("does not modify project storage, native pixels or 3D geometry when changing languages", async () => {
    const panel = BUILTIN_PANELS.find((p) => p.id === "r1000-p39");
    if (!panel) throw new Error("Missing P3.9 fixture");
    const project = newProject(panel);
    const lookup = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);
    localStorage.setItem("mansso.projects.v1", JSON.stringify(project));
    const saved = localStorage.getItem("mansso.projects.v1");
    const before = scene3d(project, lookup);
    const screen = project.screens[0];
    if (!screen) throw new Error("Missing screen fixture");
    for (const language of ["en", "pt-BR", "es"] as const) {
      await setLocale(language);
      expect(currentLocale()).toBe(language);
      expect(localStorage.getItem("mansso.projects.v1")).toBe(saved);
      expect(screenStats(screen, lookup).activePixels).toBe(1_048_576);
      expect(scene3d(project, lookup)).toEqual(before);
    }
  });
});