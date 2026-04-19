import type { ReactNode } from "react";
import clsx from "clsx";

type Tone = "default" | "green" | "red" | "violet";

const toneClasses: Record<Tone, string> = {
  default: "text-neutral-900",
  green: "text-emerald-600",
  red: "text-red-600",
  violet: "text-violet-700",
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
    <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-card">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
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
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
