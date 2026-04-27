import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "accent" | "green" | "yellow" | "red" | "blue";

const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.04] text-ink-muted border-surface-border",
  accent: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  yellow: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  red: "bg-red-500/10 text-red-300 border-red-500/25",
  blue: "bg-sky-500/10 text-sky-300 border-sky-500/20",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  icon?: ReactNode;
};

export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
  ...rest
}: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tracking-tight",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
