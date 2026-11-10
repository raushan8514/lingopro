import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminStatus,
} from "@/components/admin/admin-components";
import { getAdminReports } from "@/lib/admin/data";

export const metadata = { title: "Platform reports", robots: { index: false, follow: false } };

function monthLabel(value) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function BarList({ items, labelKey, valueKey, nameMap = {} }) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey]) || 0));
  return (
    <div className="admin-bar-list">
      {items.map((item) => {
        const value = Number(item[valueKey]) || 0;
        const label = nameMap[item[labelKey]] || String(item[labelKey]).replaceAll("_", " ");
        return (
          <div className="admin-bar-row" key={String(item[labelKey])}>
            <div><span>{label}</span><strong>{value.toLocaleString()}</strong></div>
            <span className="admin-bar-track"><span style={{ width: `${value ? Math.max(2, value / max * 100) : 0}%` }} /></span>
          </div>
        );
      })}
    </div>
  );
}

export default async function AdminReportsPage({ searchParams }) {
  const params = await searchParams;
  const data = await getAdminReports(params);
  const roles = data.roles || [];
  const statuses = data.course_statuses || [];
  const months = data.monthly_enrollments || [];
  const progressRecords = Number(data.lesson_completion?.progress_records) || 0;
  const completedRecords = Number(data.lesson_completion?.completed_records) || 0;
  const completionRate = progressRecords ? Math.round(completedRecords / progressRecords * 100) : null;
  const popular = data.popular_courses || [];
  const instructors = data.instructor_activity || [];
  return (
    <div className="student-page admin-page">
      <AdminPageHeader eyebrow="Platform analytics" title="Reports" description={`Real platform aggregates · ${data.period_months} months · since ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${data.period_start}T00:00:00Z`))}`} />
      <form className="admin-period-form" method="get">
        <label htmlFor="report-months">Enrollment reporting period</label>
        <select id="report-months" name="months" defaultValue={String(data.period_months)}>
          {[3, 6, 12, 24].map((period) => <option value={period} key={period}>{period} months</option>)}
        </select>
        <button className="admin-button admin-button-secondary" type="submit">Update period</button>
      </form>

      <div className="admin-report-grid">
        <AdminPanel eyebrow="Account mix" title="Users by role">
          {roles.length ? <BarList items={roles} labelKey="role" valueKey="count" /> : <AdminEmptyState title="No users yet" description="Role distribution appears when platform accounts exist." />}
        </AdminPanel>
        <AdminPanel eyebrow="Catalog" title="Courses by status">
          {statuses.length ? <BarList items={statuses} labelKey="status" valueKey="count" /> : <AdminEmptyState title="No courses yet" description="Course status totals appear when courses exist." />}
        </AdminPanel>
        <AdminPanel eyebrow="Enrollment trend" title="New enrollments by month" className="admin-report-wide">
          {months.length ? (
            <div className="admin-month-chart" role="img" aria-label="Monthly enrollment counts">
              {months.map((month) => {
                const max = Math.max(1, ...months.map((item) => Number(item.count) || 0));
                const count = Number(month.count) || 0;
                return (
                  <div className="admin-month-column" key={month.month} title={`${monthLabel(month.month)}: ${count} enrollments`}>
                    <span className="admin-month-value">{count}</span>
                    <span className="admin-month-bar" style={{ height: `${count ? Math.max(3, count / max * 100) : 2}%` }} />
                    <span className="admin-month-label">{monthLabel(month.month)}</span>
                  </div>
                );
              })}
            </div>
          ) : <AdminEmptyState title="No enrollment records" description="Monthly enrollment counts appear when learners enroll in courses." />}
        </AdminPanel>
        <AdminPanel eyebrow="Course popularity" title="Most enrolled courses">
          {popular.length ? (
            <div className="admin-record-list">
              {popular.map((course) => (
                <article className="admin-record-row" key={course.id}>
                  <div><Link href={`/admin/courses/${course.id}`}>{course.title}</Link><p>{course.instructor_name} · <AdminStatus value={course.status} /></p></div>
                  <strong>{Number(course.enrollment_count).toLocaleString()}</strong>
                </article>
              ))}
            </div>
          ) : <AdminEmptyState title="No course data" description="Course popularity is calculated from recorded enrollment rows." />}
        </AdminPanel>
        <AdminPanel eyebrow="Instructor activity" title="Teaching accounts">
          {instructors.length ? (
            <div className="admin-record-list">
              {instructors.map((instructor) => (
                <article className="admin-record-row" key={instructor.id}>
                  <div>
                    <Link href={`/admin/instructors/${instructor.id}`}>{instructor.full_name}</Link>
                    <p>{Number(instructor.course_count).toLocaleString()} courses · {Number(instructor.enrollment_count).toLocaleString()} enrollments · Last course update {instructor.last_course_update ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(instructor.last_course_update)) : "never"}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : <AdminEmptyState title="No instructor activity" description="Instructor course and enrollment activity appears when those records exist." />}
        </AdminPanel>
        <AdminPanel eyebrow="Learning outcomes" title="Lesson progress">
          <div className="admin-report-summary">
            <strong>{completedRecords.toLocaleString()}</strong>
            <span>completed progress records</span>
            <p>{progressRecords.toLocaleString()} total progress records · {data.lesson_completion.published_lessons.toLocaleString()} published lessons</p>
            <p>{completionRate === null ? "No lesson progress has been recorded." : `${completionRate}% of tracked progress records are complete.`}</p>
          </div>
        </AdminPanel>
        <AdminPanel eyebrow="Assessment participation" title="Assessment outcomes">
          <div className="admin-report-summary">
            <strong>{Number(data.assessments.attempts).toLocaleString()}</strong>
            <span>attempts recorded</span>
            <p>{Number(data.assessments.graded_attempts).toLocaleString()} graded attempts</p>
            <p>{data.assessments.average_score_percent === null ? "No graded outcomes yet." : `Mean score: ${data.assessments.average_score_percent}% of possible points.`}</p>
          </div>
        </AdminPanel>
      </div>
      <p className="admin-capability-note">Reports contain aggregate data only. Enrollment trends are bounded to the selected calendar-month period; all-time participation totals are labeled separately.</p>
    </div>
  );
}
