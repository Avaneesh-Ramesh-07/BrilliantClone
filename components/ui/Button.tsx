import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:opacity-90 disabled:opacity-50",
  secondary:
    "bg-surface text-text border border-border hover:bg-primary-light",
  ghost: "bg-transparent text-muted hover:text-text",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      fullWidth = false,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 py-2 text-body font-medium transition-opacity ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
