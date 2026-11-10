import Link from "next/link";
import { cn } from "@/lib/utils";

export function Container({ as: Element = "div", className, ...props }) {
  return <Element className={cn("layout-container", className)} {...props} />;
}

export function Section({ as: Element = "section", className, ...props }) {
  return <Element className={cn("layout-section", className)} {...props} />;
}

export function Stack({ as: Element = "div", gap = "md", className, ...props }) {
  return (
    <Element
      className={cn("layout-stack", `layout-gap-${gap}`, className)}
      {...props}
    />
  );
}

export function Grid({
  as: Element = "div",
  columns = 2,
  gap = "md",
  className,
  style,
  ...props
}) {
  const mobileColumns = Math.min(Math.max(Number(columns) || 1, 1), 2);

  return (
    <Element
      className={cn("layout-grid", `layout-gap-${gap}`, className)}
      style={{
        "--layout-columns": columns,
        "--layout-columns-mobile": mobileColumns,
        ...style,
      }}
      {...props}
    />
  );
}

export function ResponsiveContent({ children, className }) {
  return (
    <div className={cn("layout-responsive-content", className)}>{children}</div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={cn("layout-page-header", className)}>
      <div>
        {eyebrow && <p className="layout-page-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="layout-page-description">{description}</p>}
      </div>
      {actions && <div className="layout-page-actions">{actions}</div>}
    </header>
  );
}

export function AppNavigation({ items, activeHref, label = "Primary navigation" }) {
  return (
    <nav className="layout-navigation" aria-label={label}>
      {items.map(({ href, label: itemLabel, icon: Icon }) => {
        const active = href === activeHref;

        return (
          <Link
            key={href}
            className={cn("layout-navigation-link", active && "is-active")}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            {Icon && <Icon size={18} strokeWidth={1.8} aria-hidden="true" />}
            <span>{itemLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
