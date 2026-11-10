import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  AdminSearchForm,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminActivity } from "@/lib/admin/data";

export const metadata = { title: "Administrative audit log", robots: { index: false, follow: false } };

function entityHref(log) {
  if (!log.entity_id) return null;
  const paths = {
    profile: "/admin/users/",
    course: "/admin/courses/",
    assessment: "/admin/assessments/",
  };
  return paths[log.entity_type] ? `${paths[log.entity_type]}${log.entity_id}` : null;
}

export default async function AdminActivityPage({ searchParams }) {
  const params = await searchParams;
  const data = await getAdminActivity(params);
  return (
    <div className="student-page admin-page">
      <AdminPageHeader eyebrow="Immutable administrative history" title="Audit log" description="Review sensitive platform changes recorded by trusted database operations and administrator-only management actions." />
      <AdminPanel>
        <AdminSearchForm
          search={data.search}
          action="/admin/activity"
          filters={[{
            name: "entity",
            label: "Entity",
            value: data.entity,
            options: [
              { value: "profile", label: "User" },
              { value: "course", label: "Course" },
              { value: "category", label: "Category" },
              { value: "assessment", label: "Assessment" },
              { value: "setting", label: "Setting" },
            ],
          }]}
        />
        {data.logs.length ? (
          <div className="admin-audit-list">
            {data.logs.map((log) => {
              const href = entityHref(log);
              return (
                <article className="admin-audit-row" key={log.id}>
                  <span className="admin-audit-dot" aria-hidden="true" />
                  <div className="admin-audit-main">
                    <strong>{log.action.replaceAll(".", " ").replaceAll("_", " ")}</strong>
                    <p>
                      {log.administratorName} · {log.entity_type}
                      {href ? <> · <Link href={href}>Open record</Link></> : log.metadata.setting_key ? ` · ${log.metadata.setting_key}` : ""}
                    </p>
                    {Object.keys(log.metadata || {}).length > 0 && (
                      <dl className="admin-audit-meta">
                        {Object.entries(log.metadata).map(([key, value]) => (
                          <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>
                        ))}
                      </dl>
                    )}
                    {log.reason && <blockquote>{log.reason}</blockquote>}
                  </div>
                  <time dateTime={log.created_at}>{formatAdminDate(log.created_at, { time: true })}</time>
                </article>
              );
            })}
          </div>
        ) : <AdminEmptyState title="No audit events found" description="Administrative role, category, moderation, and setting changes will be recorded here." />}
        <AdminPagination page={data.page} pageSize={data.pageSize} total={data.total} searchParams={{ q: data.search, entity: data.entity }} />
      </AdminPanel>
      <p className="admin-capability-note">Audit entries are append-only for application roles. Setting values, passwords, tokens, answer keys, and learner responses are never copied into audit metadata.</p>
    </div>
  );
}
