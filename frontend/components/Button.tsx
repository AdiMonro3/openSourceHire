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
    "bg-violet-600 text-white shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset,0_4px_14px_-4px_rgba(124,58,237,0.55)] hover:bg-violet-700",
  secondary:
    "border border-surface-border bg-white text-neutral-900 hover:bg-surface-hover hover:border-neutral-300",
  ghost:
    "text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100",
  danger:
    "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
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
              ? "border-white/40 border-t-white"
              : "border-neutral-300 border-t-neutral-700",
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
