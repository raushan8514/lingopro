import Link from "next/link";
import {
  Activity,
  Archive,
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Layers3,
  UsersRound,
  Video,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  AdminStatus,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminDashboardData } from "@/lib/admin/data";

export const metadata = {
  title: "Platform overview",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();
  const { users, courses } = data;
  const pendingCourses = data.pending_courses || [];
  const recentAudit = data.recent_audit || [];

  return (
    <div className="student-page admin-page">
      <AdminPageHeader
        eyebrow="Platform operations"
        title={`Good to see you, ${data.identity.fullName.split(/\s+/)[0] || "Administrator"}`}
        description="A live overview of LingoPro accounts, learning activity, and items that need review."
        actionHref="/admin/reports"
        actionLabel="View reports"
      />

      <section className="admin-stat-grid" aria-label="Platform metrics">
        <AdminStatCard Icon={UsersRound} label="Registered users" value={users.total.toLocaleString()} detail={`${users.students.toLocaleString()} students · ${users.instructors.toLocaleString()} instructors`} href="/admin/users" />
        <AdminStatCard Icon={BookOpen} label="Courses" value={courses.total.toLocaleString()} detail={`${courses.published.toLocaleString()} published`} href="/admin/courses" />
        <AdminStatCard Icon={Layers3} label="Enrollments" value={data.enrollments.toLocaleString()} detail="All recorded course enrollments" href="/admin/reports" />
        <AdminStatCard Icon={GraduationCap} label="Published lessons" value={data.published_lessons.toLocaleString()} detail="Available in published curricula" href="/admin/courses" />
        <AdminStatCard Icon={ClipboardCheck} label="Assessment attempts" value={data.assessment_attempts.toLocaleString()} detail={`${data.published_assessments.toLocaleString()} published assessments`} href="/admin/assessments" />
        <AdminStatCard Icon={Activity} label="Learning activity" value={data.activity_30_days.toLocaleString()} detail="Progress, attempts, and enrollments · 30 days" href="/admin/reports" />
      </section>

      <section className="admin-status-strip" aria-label="Course publication status">
        <span><AdminStatus value="PENDING_REVIEW" /> <strong>{courses.pending_review.toLocaleString()}</strong> awaiting review</span>
        <span><AdminStatus value="DRAFT" /> <strong>{courses.draft.toLocaleString()}</strong> drafts</span>
        <span><AdminStatus value="ARCHIVED" /> <strong>{courses.archived.toLocaleString()}</strong> archived</span>
        <span><AdminStatus value="admin" /> <strong>{users.administrators.toLocaleString()}</strong> administrators</span>
      </section>

      <div className="admin-dashboard-grid">
        <AdminPanel
          eyebrow="Moderation queue"
          title="Courses awaiting review"
          action={<Link className="admin-inline-link" href="/admin/courses?status=PENDING_REVIEW">All courses <span aria-hidden="true">→</span></Link>}
        >
          {pendingCourses.length ? (
            <div className="admin-record-list">
              {pendingCourses.map((course) => (
                <article className="admin-record-row" key={course.id}>
                  <div>
                    <Link href={`/admin/courses/${course.id}`}>{course.title}</Link>
                    <p>Submitted by {course.instructor_name || "Instructor"} · Updated {formatAdminDate(course.updated_at)}</p>
                  </div>
                  <AdminStatus value="PENDING_REVIEW" />
                </article>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="Nothing to review" description="Submitted courses will appear here when an instructor requests review." />
          )}
        </AdminPanel>

        <AdminPanel
          eyebrow="Recent accounts"
          title="Newly registered users"
          action={<Link className="admin-inline-link" href="/admin/users">User directory <span aria-hidden="true">→</span></Link>}
        >
          {data.recent_users?.length ? (
            <div className="admin-record-list">
              {data.recent_users.map((user) => (
                <article className="admin-record-row" key={user.id}>
                  <div>
                    <Link href={`/admin/users/${user.id}`}>{user.full_name}</Link>
                    <p>{user.email} · Joined {formatAdminDate(user.created_at)}</p>
                  </div>
                  <AdminStatus value={user.role} />
                </article>
              ))}
            </div>
          ) : (
            <AdminEmptyState title="No user records" description="New account records will appear here." />
          )}
        </AdminPanel>
      </div>

      <AdminPanel
        eyebrow="Administrative actions"
        title="Recent audit history"
        action={<Link className="admin-inline-link" href="/admin/activity">Open audit log <span aria-hidden="true">→</span></Link>}
      >
        {recentAudit.length ? (
          <div className="admin-record-list">
            {recentAudit.map((entry) => (
              <article className="admin-record-row" key={entry.id}>
                <div>
                  <strong>{entry.action.replaceAll(".", " ").replaceAll("_", " ")}</strong>
                  <p>{entry.entity_type} · {formatAdminDate(entry.created_at, { time: true })}{entry.reason ? ` · ${entry.reason}` : ""}</p>
                </div>
                <Link className="admin-inline-link" href="/admin/activity">Details <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        ) : (
          <AdminEmptyState title="No administrative activity recorded" description="Sensitive administrative changes will be recorded here." />
        )}
      </AdminPanel>

      <AdminPanel eyebrow="Workspace" title="Administrative shortcuts">
        <div className="admin-shortcut-grid">
          <Link href="/admin/instructors"><GraduationCap size={19} />Manage instructors</Link>
          <Link href="/admin/categories"><Layers3 size={19} />Manage categories</Link>
          <Link href="/admin/assessments"><ClipboardCheck size={19} />Review assessments</Link>
          <Link href="/admin/certificates"><Award size={19} />Review certificates</Link>
          <Link href="/admin/live-classes"><Video size={19} />Live class oversight</Link>
          <Link href="/admin/settings"><Archive size={19} />Platform settings</Link>
        </div>
      </AdminPanel>
    </div>
  );
}
