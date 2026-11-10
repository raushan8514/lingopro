import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

const alertIcons = {
  information: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};

export function Alert({ variant = "information", title, children, className }) {
  const Icon = alertIcons[variant] || Info;

  return (
    <div
      className={cn("ui-alert", `ui-alert-${variant}`, className)}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className="ui-alert-icon" size={18} aria-hidden="true" />
      <div className="ui-alert-copy">
        {title && <p className="ui-alert-title">{title}</p>}
        {children && <div className="ui-alert-description">{children}</div>}
      </div>
    </div>
  );
}

export function Separator({ orientation = "horizontal", className }) {
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      className={cn(
        "ui-separator",
        isHorizontal ? "ui-separator-horizontal" : "ui-separator-vertical",
        className,
      )}
      role="separator"
      aria-orientation={orientation}
    />
  );
}

export function EmptyState({
  icon: Icon = Info,
  title,
  description,
  action,
  className,
}) {
  return (
    <div className={cn("ui-empty-state", className)}>
      <span className="ui-empty-icon">
        <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Tooltip({ content, children, side = "top" }) {
  const tooltipId = useId();

  return (
    <span
      className="ui-tooltip"
      tabIndex={0}
      aria-describedby={tooltipId}
      data-side={side}
    >
      {children}
      <span className="ui-tooltip-content" role="tooltip" id={tooltipId}>
        {content}
      </span>
    </span>
  );
}
