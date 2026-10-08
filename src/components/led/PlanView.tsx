import type { Plan } from "@/lib/led/plan";

/** Dibuja un Plan (primitivas en mm) como SVG escalable. */
export function PlanView({ plan, className, onCabinetClick }: { plan: Plan; className?: string; onCabinetClick?: (x: number, y: number) => void }) {
  const w = plan.maxX - plan.minX, h = plan.maxY - plan.minY;
  return (
    <svg viewBox={`${plan.minX} ${plan.minY} ${w} ${h}`} className={className} role="img" aria-label={plan.title}
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
          <g key={i} transform={p.rot ? `rotate(${p.rot} ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.lw} />
            {p.hatch && <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="url(#hatch)" pointerEvents="none" />}
          </g>
        );
        if (p.t === "line") return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.lw} />;
        if (p.t === "poly") return <polyline key={i} points={p.pts.map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke={p.stroke} strokeWidth={p.lw} />;
        return (
          <text key={i} x={p.x} y={p.y} fontSize={p.size} fill={p.color} fontWeight={p.bold ? 700 : 400}
            textAnchor={p.align === "center" ? "middle" : p.align === "right" ? "end" : "start"}
            transform={p.rot ? `rotate(${p.rot} ${p.x} ${p.y})` : undefined} pointerEvents="none">{p.s}</text>
        );
      })}
    </svg>
  );
}
