import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const getVariantClasses = (variant: ButtonVariant): string => {
  if (variant === "secondary") {
    return "bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:bg-slate-800/60";
  }
  if (variant === "danger") {
    return "bg-red-700 text-white hover:bg-red-600 disabled:bg-red-800/60";
  }
  return "bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:bg-amber-300/60";
};

const getSizeClasses = (size: ButtonSize): string => {
  if (size === "sm") {
    return "px-3 py-1 text-sm";
  }
  if (size === "lg") {
    return "px-5 py-3 text-base";
  }
  return "px-4 py-2 text-sm";
};

export const Button = ({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  ...props
}: ButtonProps): ReactNode => {
  const computedDisabled = disabled || isLoading;

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed cursor-pointer",
        getVariantClasses(variant),
        getSizeClasses(size),
        isLoading ? "opacity-80" : "",
        className
      )}
      disabled={computedDisabled}
      {...props}
    >
      {isLoading ? "思考中…" : children}
    </button>
  );
};

