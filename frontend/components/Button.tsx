import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-violet-500 text-white shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_8px_28px_-8px_rgba(139,92,246,0.75)] hover:bg-violet-400",
  secondary:
    "border border-surface-border bg-surface-raised text-ink hover:bg-surface-hover hover:border-surface-border-strong",
  ghost:
    "text-ink-muted hover:text-ink hover:bg-white/5",
  danger:
    "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 hover:border-red-500/50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    leadingIcon,
    trailingIcon,
    className,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={twMerge(clsx(base, variants[variant], sizes[size], className))}
      {...rest}
    >
      {loading ? (
        <span
          className={clsx(
            "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2",
            variant === "primary"
              ? "border-white/30 border-t-white"
              : "border-white/10 border-t-ink",
          )}
        />
      ) : (
        leadingIcon
      )}
      <span className="inline-flex items-center">{children}</span>
      {!loading && trailingIcon}
    </button>
  );
});
