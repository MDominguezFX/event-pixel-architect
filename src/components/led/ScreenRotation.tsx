import { t, translateValue, useLocale } from "@/lib/i18n/react";
import { ArrowDown, ArrowUp, RotateCcw, RotateCw } from "lucide-react";
import type { Screen } from "@/lib/led/model";
import { Btn, Field, Num } from "./ui";

export function ScreenRotation({ screen, onChange }: { screen: Screen; onChange: (values: Partial<Screen>) => void }) {
  useLocale();
  const tilt = screen.mountTiltDeg ?? (screen.mount === "techo" ? 90 : 0);
  const yaw = screen.mountYawDeg ?? 0;
  const setTilt = (value: number) => onChange({ mountTiltDeg: value, mount: Math.abs(value % 180) === 90 ? "techo" : "pared" });
  return <div className="flex flex-wrap items-end gap-3" role="group" aria-label={t("Giro de toda la pantalla")}>
    <Field label={t("Arriba / abajo °")}>
      <div className="flex items-center gap-1">
        <Btn variant="outline" title={t("Girar hacia arriba 5°")} onClick={() => setTilt(tilt + 5)}><ArrowUp size={translateValue(14)} /></Btn>
        <Num className="w-20" aria-label={t("Giro arriba / abajo")} value={translateValue(tilt)} step={translateValue(1)} onChange={(v) => setTilt(v ?? 0)} />
        <Btn variant="outline" title={t("Girar hacia abajo 5°")} onClick={() => setTilt(tilt - 5)}><ArrowDown size={translateValue(14)} /></Btn>
      </div>
    </Field>
    <Field label={t("Adelante / atrás °")}>
      <div className="flex items-center gap-1">
        <Btn variant="outline" title={t("Girar adelante 5°")} onClick={() => onChange({ mountYawDeg: yaw + 5 })}><RotateCw size={translateValue(14)} /></Btn>
        <Num className="w-20" aria-label={t("Giro adelante / atrás")} value={translateValue(yaw)} step={translateValue(1)} onChange={(v) => onChange({ mountYawDeg: v ?? 0 })} />
        <Btn variant="outline" title={t("Girar atrás 5°")} onClick={() => onChange({ mountYawDeg: yaw - 5 })}><RotateCcw size={translateValue(14)} /></Btn>
      </div>
    </Field>
    <Btn variant="outline" onClick={() => onChange({ mountTiltDeg: 0, mountYawDeg: 0, mount: "pared" })}>{t("Pared · 0°")}</Btn>
    <Btn variant="outline" onClick={() => setTilt(90)}>{t("Techo · 90°")}</Btn>
  </div>;
}