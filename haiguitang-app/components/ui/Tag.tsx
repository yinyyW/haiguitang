import type { ReactNode } from "react";
import clsx from "clsx";

type TagVariant = "default" | "clear" | "red" | "black" | "answer-yes" | "answer-no" | "answer-irrelevant" | "answer-mixed";
type TagSize = "sm" | "md";

interface TagProps {
  children: ReactNode;
  variant?: TagVariant;
  size?: TagSize;
  className?: string;
}

const getTagVariantClasses = (variant: TagVariant): string => {
  if (variant === "clear") {
    return "bg-soup-clear/20 text-amber-200 border-amber-200/30";
  }
  if (variant === "red") {
    return "bg-soup-red/30 text-red-100 border-red-300/40";
  }
  if (variant === "black") {
    return "bg-soup-black text-slate-200 border-slate-500/60";
  }
  if (variant === "answer-yes") {
    return "bg-emerald-500/20 text-emerald-600 border-emerald-300/40";
  }
  if (variant === "answer-no") {
    return "bg-rose-500/20 text-rose-200 border-rose-300/40";
  }
  if (variant === "answer-irrelevant") {
    return "bg-slate-600/40 text-slate-200 border-slate-400/60";
  }
  if (variant === "answer-mixed") {
    return "bg-amber-500/20 text-amber-200 border-amber-300/40";
  }
  return "bg-slate-800/70 text-slate-100 border-slate-600/70";
};

const getTagSizeClasses = (size: TagSize): string => {
  if (size === "sm") {
    return "px-2 py-0.5 text-[10px]";
  }
  return "px-2.5 py-1 text-xs";
};

export const Tag = ({
  children,
  variant = "default",
  size = "md",
  className,
}: TagProps): ReactNode => {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border font-medium uppercase tracking-wide",
        getTagVariantClasses(variant),
        getTagSizeClasses(size),
        className
      )}
    >
      {children}
    </span>
  );
};

type BadgeVariant = "default" | "outline";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge = ({
  children,
  variant = "default",
  className,
}: BadgeProps): ReactNode => {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "outline"
          ? "border border-slate-600 text-slate-200"
          : "bg-slate-700 text-slate-100",
        className
      )}
    >
      {children}
    </span>
  );
};

