import { ArrowDown, ArrowUp, RotateCcw, RotateCw } from "lucide-react";
import type { Screen } from "@/lib/led/model";
import { Btn, Field, Num } from "./ui";

export function ScreenRotation({ screen, onChange }: { screen: Screen; onChange: (values: Partial<Screen>) => void }) {
  const tilt = screen.mountTiltDeg ?? (screen.mount === "techo" ? 90 : 0);
  const yaw = screen.mountYawDeg ?? 0;
  const setTilt = (value: number) => onChange({ mountTiltDeg: value, mount: Math.abs(value % 180) === 90 ? "techo" : "pared" });
  return <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Giro de toda la pantalla">
    <Field label="Arriba / abajo °">
      <div className="flex items-center gap-1">
        <Btn variant="outline" title="Girar hacia arriba 5°" onClick={() => setTilt(tilt + 5)}><ArrowUp size={14} /></Btn>
        <Num className="w-20" aria-label="Giro arriba / abajo" value={tilt} step={1} onChange={(v) => setTilt(v ?? 0)} />
        <Btn variant="outline" title="Girar hacia abajo 5°" onClick={() => setTilt(tilt - 5)}><ArrowDown size={14} /></Btn>
      </div>
    </Field>
    <Field label="Adelante / atrás °">
      <div className="flex items-center gap-1">
        <Btn variant="outline" title="Girar adelante 5°" onClick={() => onChange({ mountYawDeg: yaw + 5 })}><RotateCw size={14} /></Btn>
        <Num className="w-20" aria-label="Giro adelante / atrás" value={yaw} step={1} onChange={(v) => onChange({ mountYawDeg: v ?? 0 })} />
        <Btn variant="outline" title="Girar atrás 5°" onClick={() => onChange({ mountYawDeg: yaw - 5 })}><RotateCcw size={14} /></Btn>
      </div>
    </Field>
    <Btn variant="outline" onClick={() => onChange({ mountTiltDeg: 0, mountYawDeg: 0, mount: "pared" })}>Pared · 0°</Btn>
    <Btn variant="outline" onClick={() => setTilt(90)}>Techo · 90°</Btn>
  </div>;
}