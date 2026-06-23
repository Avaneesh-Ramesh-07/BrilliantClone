import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`min-h-[44px] w-full rounded-lg border border-border bg-surface px-4 py-2 text-equation text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-light ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
