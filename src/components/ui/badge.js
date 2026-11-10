import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeStyles = cva("ui-badge", {
  variants: {
    variant: {
      neutral: "ui-badge-neutral",
      success: "ui-badge-success",
      warning: "ui-badge-warning",
      error: "ui-badge-error",
      information: "ui-badge-information",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeStyles({ variant }), className)} {...props} />;
}
