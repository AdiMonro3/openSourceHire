import type { ReactNode } from "react";
import clsx from "clsx";

type Tone = "default" | "green" | "red" | "violet";

const toneClasses: Record<Tone, string> = {
  default: "text-ink",
  green: "text-emerald-300",
  red: "text-red-300",
  violet: "text-violet-300",
};

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-card">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        <span>{label}</span>
        {icon}
      </div>
      <div
        className={clsx(
          "mt-2 font-mono text-2xl font-semibold tabular-nums",
          toneClasses[tone],
        )}
      >
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
