import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "accent" | "green" | "yellow" | "red" | "blue";

const tones: Record<Tone, string> = {
  neutral: "bg-white text-neutral-700 border-neutral-200",
  accent: "bg-violet-50 text-violet-700 border-violet-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
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
