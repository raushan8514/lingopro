import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonStyles = cva("ui-button", {
  variants: {
    variant: {
      primary: "ui-button-primary",
      secondary: "ui-button-secondary",
      outline: "ui-button-outline",
      ghost: "ui-button-ghost",
      destructive: "ui-button-destructive",
    },
    size: {
      sm: "ui-button-sm",
      md: "ui-button-md",
      lg: "ui-button-lg",
      icon: "ui-button-icon",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

const Button = forwardRef(function Button(
  {
    children,
    className,
    variant,
    size,
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonStyles({ variant, size }), className)}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="ui-spinner-icon" size={17} aria-hidden="true" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export { Button, buttonStyles };
