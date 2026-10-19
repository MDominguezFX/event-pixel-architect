import { t, translateValue, useLocale } from "@/lib/i18n/react";
import type { Plan } from "@/lib/led/plan";

/** Dibuja un Plan (primitivas en mm) como SVG escalable. */
export function PlanView({ plan, className, onCabinetClick }: { plan: Plan; className?: string; onCabinetClick?: (x: number, y: number) => void }) {
  useLocale();
  const w = plan.maxX - plan.minX, h = plan.maxY - plan.minY;
  return (
    <svg viewBox={translateValue(`${plan.minX} ${plan.minY} ${w} ${h}`)} className={translateValue(className)} role="img" aria-label={translateValue(plan.title)}
      onClick={(e) => {
        if (!onCabinetClick) return;
        const svg = e.currentTarget, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM()!.inverse()); onCabinetClick(p.x, p.y);
      }}>
      <defs>
        <pattern id="hatch" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="60" stroke="white" strokeOpacity="0.35" strokeWidth="14" />
        </pattern>
      </defs>
      {plan.prims.map((p, i) => {
        if (p.t === "rect") return (
          <g key={translateValue(i)} transform={translateValue(p.rot ? `rotate(${p.rot} ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined)}>
            <rect x={translateValue(p.x)} y={translateValue(p.y)} width={translateValue(p.w)} height={translateValue(p.h)} fill={translateValue(p.fill ?? "none")} stroke={translateValue(p.stroke)} strokeWidth={translateValue(p.lw)} />
            {p.hatch && <rect x={translateValue(p.x)} y={translateValue(p.y)} width={translateValue(p.w)} height={translateValue(p.h)} fill="url(#hatch)" pointerEvents="none" />}
          </g>
        );
        if (p.t === "line") return <line key={translateValue(i)} x1={translateValue(p.x1)} y1={translateValue(p.y1)} x2={translateValue(p.x2)} y2={translateValue(p.y2)} stroke={translateValue(p.stroke)} strokeWidth={translateValue(p.lw)} />;
        if (p.t === "poly") return <polyline key={translateValue(i)} points={p.pts.map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke={translateValue(p.stroke)} strokeWidth={translateValue(p.lw)} />;
        return (
          <text key={translateValue(i)} x={translateValue(p.x)} y={translateValue(p.y)} fontSize={translateValue(p.size)} fill={translateValue(p.color)} fontWeight={translateValue(p.bold ? 700 : 400)}
            textAnchor={translateValue(p.align === "center" ? "middle" : p.align === "right" ? "end" : "start")}
            transform={translateValue(p.rot ? `rotate(${p.rot} ${p.x} ${p.y})` : undefined)} pointerEvents="none">{translateValue(p.s)}</text>
        );
      })}
    </svg>
  );
}
