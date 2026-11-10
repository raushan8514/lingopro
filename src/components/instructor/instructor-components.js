import Link from "next/link";
import { ArrowRight, BookOpen, Plus } from "lucide-react";

export function InstructorPageHeader({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
}) {
  return (
    <header className="instructor-page-header">
      <div>
        {eyebrow && <p className="instructor-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="instructor-page-description">{description}</p>}
      </div>
      {actionHref && actionLabel && (
        <Link className="instructor-button-link" href={actionHref}>
          <Plus size={16} aria-hidden="true" />
          {actionLabel}
        </Link>
      )}
    </header>
  );
}

export function InstructorMetric({ icon: Icon, label, value, detail, tone = "green" }) {
  return (
    <article className={`instructor-metric tone-${tone}`}>
      <span className="instructor-metric-icon">
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </article>
  );
}

export function InstructorPanel({ title, eyebrow, action, children, className = "" }) {
  return (
    <section className={`instructor-panel${className ? ` ${className}` : ""}`}>
      {(title || eyebrow || action) && (
        <header className="instructor-panel-header">
          <div>
            {eyebrow && <p className="instructor-eyebrow">{eyebrow}</p>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function InstructorStatus({ status }) {
  const tone = {
    DRAFT: "neutral",
    PENDING_REVIEW: "warning",
    PUBLISHED: "success",
    ARCHIVED: "muted",
    ACTIVE: "success",
    COMPLETED: "information",
    CANCELLED: "muted",
    SCHEDULED: "information",
    ATTENDED: "success",
    NO_SHOW: "muted",
    HOST_PROVIDED: "warning",
    EXPIRED: "warning",
    IN_PROGRESS: "information",
    PENDING_REVIEW_ATTEMPT: "warning",
    GRADED: "success",
  }[status] || "neutral";

  return (
    <span className={`instructor-status is-${tone}`}>
      {String(status || "UNKNOWN").replaceAll("_", " ")}
    </span>
  );
}

export function InstructorEmptyState({
  title,
  description,
  href,
  actionLabel,
  icon: Icon = BookOpen,
}) {
  return (
    <div className="instructor-empty-state">
      <span className="instructor-empty-icon"><Icon size={22} aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {href && actionLabel && (
        <Link className="instructor-inline-link" href={href}>
          {actionLabel} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function formatInstructorDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...options,
  }).format(date);
}

export function formatInstructorDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatInstructorPercent(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))}%` : "—";
}
