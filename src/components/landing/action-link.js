import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ActionLink({
  href,
  children,
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className,
  ...props
}) {
  return (
    <Link
      href={href}
      className={cn(buttonStyles({ variant, size }), "landing-action-link", className)}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
