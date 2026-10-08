import { it } from "vitest";
import { BUILTIN_PANELS } from "@/lib/led/catalog";
import { newScreen } from "@/lib/led/model";
import { cableRuns } from "@/lib/led/cabling";
import { buildMix, mixOptions } from "@/lib/led/mix";
import { rotateGroup } from "@/lib/led/edit";
const lookup = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);
it("x", () => {
  const S = lookup("r500-p39")!, L = lookup("r1000-p39")!;
  const inp = { small: S, large: L, wantWmm: 4000, wantHmm: 2500, goal: "menos" } as any;
  for (const o of mixOptions(inp)) { const s = newScreen(S); s.cabinets = buildMix(inp, o, "arriba");
    console.log("mix", s.cabinets.length, cableRuns(s, lookup).runs.map((x) => x.cabinets.length).join(","));
    const r = rotateGroup(s.cabinets, new Set(s.cabinets.map(c=>c.id)), lookup); if (r) console.log("rot90", cableRuns({ ...s, cabinets: r }, lookup).runs.map((x) => x.cabinets.length).join(","));
  }
});
