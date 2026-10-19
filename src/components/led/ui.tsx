import { t, translateValue, useLocale } from "@/lib/i18n/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  useLocale();
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground", className)}>
      {translateValue(label)}
      {translateValue(children)}
    </label>
  );
}
export const inputCls = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

export function Num({ value, onChange, min, step, className }: { value: number | undefined; onChange: (v: number | undefined) => void; min?: number; step?: number; className?: string }) {
  useLocale();
  return (
    <input type="number" inputMode="decimal" className={cn(inputCls, className)} value={value ?? ""} min={min} step={step}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
  );
}

export function Btn({ children, onClick, variant = "default", className, disabled, title, "aria-pressed": pressed }: { children: ReactNode; onClick?: () => void; variant?: "default" | "outline" | "ghost" | "danger"; className?: string; disabled?: boolean; title?: string; "aria-pressed"?: boolean }) {
  useLocale();
  const v = {
    default: "bg-primary text-primary-foreground hover:opacity-90",
    outline: "border border-border bg-card text-foreground hover:bg-muted",
    ghost: "text-foreground hover:bg-muted",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
  }[variant];
  return (
    <button type="button" title={translateValue(title)} disabled={disabled} onClick={onClick} aria-pressed={pressed}
      className={cn("inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition disabled:opacity-40", v, className)}>
      {translateValue(children)}
    </button>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  useLocale();
  return (
    <section className={cn("min-w-0 rounded-md border border-border bg-card p-3 sm:p-4", className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-extrabold text-foreground">{translateValue(title)}</h2>}
          {translateValue(actions)}
        </div>
      )}
      {translateValue(children)}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  useLocale();
  return (
    <div className="min-w-0 rounded-lg bg-muted px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{translateValue(label)}</div>
      <div className="truncate text-base font-extrabold text-foreground">{translateValue(value)}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{translateValue(hint)}</div>}
    </div>
  );
}

export function Notice({ kind = "warn", children }: { kind?: "warn" | "error" | "info"; children: ReactNode }) {
  useLocale();
  const c = { warn: "border-warning bg-warning/10", error: "border-destructive bg-destructive/10", info: "border-primary bg-primary/10" }[kind];
  return <div className={cn("rounded-md border-l-4 px-3 py-2 text-xs text-foreground", c)}>{translateValue(children)}</div>;
}
