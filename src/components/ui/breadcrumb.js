import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function Breadcrumb({ items, label = "Breadcrumb" }) {
  return (
    <nav aria-label={label} className="ui-breadcrumb">
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`}>
              {item.href && !current ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={current ? "page" : undefined}>{item.label}</span>
              )}
              {!current && <ChevronRight size={14} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
