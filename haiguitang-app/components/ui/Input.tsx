import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import clsx from "clsx";

interface BaseFieldProps {
  isLoading?: boolean;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & BaseFieldProps;

const getFieldClasses = (): string => {
  return "w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60";
};

export const Input = ({
  className,
  isLoading = false,
  disabled,
  ...props
}: InputProps): ReactNode => {
  const computedDisabled = disabled || isLoading;

  return (
    <input
      className={clsx(
        getFieldClasses(),
        isLoading ? "pr-10" : "",
        className
      )}
      disabled={computedDisabled}
      {...props}
    />
  );
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  BaseFieldProps;

export const Textarea = ({
  className,
  isLoading = false,
  disabled,
  rows = 3,
  ...props
}: TextareaProps): ReactNode => {
  const computedDisabled = disabled || isLoading;

  return (
    <textarea
      className={clsx(
        getFieldClasses(),
        "min-h-[80px] resize-none",
        isLoading ? "pr-10" : "",
        className
      )}
      disabled={computedDisabled}
      rows={rows}
      {...props}
    />
  );
};

