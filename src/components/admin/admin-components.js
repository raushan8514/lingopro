import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";

export function AdminPageHeader({ eyebrow, title, description, actionHref, actionLabel }) {
  return (
    <header className="admin-page-header">
      <div>
        {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actionHref && actionLabel && (
        <Link className="admin-button admin-button-primary" href={actionHref}>
          {actionLabel} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </header>
  );
}

export function AdminPanel({ eyebrow, title, action, children, className = "" }) {
  return (
    <section className={`admin-panel ${className}`.trim()}>
      {(eyebrow || title || action) && (
        <header className="admin-panel-heading">
          <div>
            {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function AdminStatCard({ label, value, detail, Icon, href }) {
  const content = (
    <>
      <span className="admin-stat-icon"><Icon size={18} aria-hidden="true" /></span>
      <span className="admin-stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="admin-stat-detail">{detail}</span>
    </>
  );
  return href
    ? <Link className="admin-stat-card" href={href}>{content}</Link>
    : <article className="admin-stat-card">{content}</article>;
}

export function AdminStatus({ value }) {
  const label = String(value || "unknown").replaceAll("_", " ").toLowerCase();
  const state = {
    published: "success",
    active: "success",
    graded: "success",
    issued: "success",
    attended: "success",
    confirmed: "success",
    draft: "neutral",
    student: "neutral",
    instructor: "info",
    admin: "warning",
    pending_review: "warning",
    flagged: "inactive",
    cleared: "success",
    not_reviewed: "muted",
    scheduled: "info",
    archived: "muted",
    inactive: "inactive",
    unpublished: "muted",
    completed: "success",
    cancelled: "muted",
    revoked: "inactive",
    no_show: "muted",
    host_provided: "warning",
    unconfigured: "warning",
    failed: "inactive",
    expired: "muted",
    in_progress: "info",
    pending_review_attempt: "warning",
  }[String(value || "").toLowerCase()] || "neutral";
  return <span className={`admin-status is-${state}`}>{label}</span>;
}

export function AdminEmptyState({ title, description, actionHref, actionLabel }) {
  return (
    <div className="admin-empty-state">
      <span><ShieldAlert size={20} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionHref && <Link className="admin-inline-link" href={actionHref}>{actionLabel} <ArrowRight size={15} /></Link>}
    </div>
  );
}

export function AdminSearchForm({
  search = "",
  filters = [],
  action,
  submitLabel = "Apply filters",
}) {
  return (
    <form className="admin-filter-form" method="get" action={action}>
      <label className="admin-search-field">
        <span className="sr-only">Search</span>
        <input type="search" name="q" defaultValue={search} placeholder="Search records…" maxLength={100} />
      </label>
      {filters.map((filter) => (
        <label className="admin-filter-field" key={filter.name}>
          <span className="sr-only">{filter.label}</span>
          <select name={filter.name} defaultValue={filter.value || ""} aria-label={filter.label}>
            <option value="">{filter.placeholder || `All ${filter.label.toLowerCase()}`}</option>
            {filter.options.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ))}
      <button className="admin-button admin-button-secondary" type="submit">{submitLabel}</button>
    </form>
  );
}

export function AdminPagination({ page, pageSize, total, searchParams = {} }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const hrefFor = (nextPage) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    params.set("page", String(nextPage));
    return `?${params.toString()}`;
  };
  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <span>Page {page} of {pages} · {total.toLocaleString()} records</span>
      <div>
        {page > 1 && <Link className="admin-button admin-button-quiet" href={hrefFor(page - 1)}><ArrowLeft size={15} /> Previous</Link>}
        {page < pages && <Link className="admin-button admin-button-quiet" href={hrefFor(page + 1)}>Next <ArrowRight size={15} /></Link>}
      </div>
    </nav>
  );
}

export function formatAdminDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  const { time = false, dateStyle = "medium", timeZone } = options;
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        dateStyle,
        ...(time && { timeStyle: "short" }),
        ...(timeZone && { timeZone }),
      }).format(date);
}
