import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Avatar({ name = "", src, size = "md", className }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className={cn("ui-avatar", `ui-avatar-${size}`, className)}
      role="img"
      aria-label={name || "User avatar"}
      style={src ? { backgroundImage: `url("${src.replaceAll('"', "%22")}")` } : undefined}
    >
      {!src && initials}
    </span>
  );
}

export function Progress({ value = 0, label, className, showValue = false }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className={cn("ui-progress-wrap", className)}>
      {(label || showValue) && (
        <div className="ui-progress-label">
          {label && <span>{label}</span>}
          {showValue && <span>{safeValue}%</span>}
        </div>
      )}
      <div
        className="ui-progress"
        role="progressbar"
        aria-label={label || "Progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
      >
        <span className="ui-progress-value" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function Skeleton({ className, ...props }) {
  return (
    <span
      className={cn("ui-skeleton", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export function Spinner({ label = "Loading", className, size = 18 }) {
  return (
    <LoaderCircle
      className={cn("ui-spinner-icon", className)}
      size={size}
      role="status"
      aria-label={label}
    />
  );
}
