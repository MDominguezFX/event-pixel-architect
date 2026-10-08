import { it } from "vitest";
import { BUILTIN_PANELS } from "@/lib/led/catalog";
import { newScreen } from "@/lib/led/model";
import { cableRuns } from "@/lib/led/cabling";
import * as mix from "@/lib/led/mix";
const lookup = (id: string) => BUILTIN_PANELS.find((p) => p.id === id);
it("x", () => {
  for (const [id,c,r] of [["r1000-p39",8,3],["r500-p39",8,5],["r500-p26",12,6],["r1000-p26",10,4]] as const) {
    const s = newScreen(lookup(id)!, "A", c, r);
    console.log(id, c, r, cableRuns(s, lookup).runs.map((x) => x.cabinets.length).join(","));
  }
  console.log(Object.keys(mix));
});
