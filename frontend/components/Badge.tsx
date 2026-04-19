import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "accent" | "green" | "yellow" | "red" | "blue";

const tones: Record<Tone, string> = {
  neutral: "bg-white/5 text-neutral-300 border-white/5",
  accent: "bg-accent-soft text-violet-200 border-accent/30",
  green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  yellow: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  red: "bg-red-500/10 text-red-300 border-red-500/20",
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
