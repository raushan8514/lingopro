import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  AdminSearchForm,
  AdminStatus,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminAssessments } from "@/lib/admin/data";

export const metadata = { title: "Assessment oversight", robots: { index: false, follow: false } };

export default async function AdminAssessmentsPage({ searchParams }) {
  const params = await searchParams;
  const data = await getAdminAssessments(params);
  return (
    <div className="student-page admin-page">
      <AdminPageHeader eyebrow="Learning integrity" title="Assessment oversight" description="Review assessment publication and participation across courses without exposing answer keys or student responses." />
      <AdminPanel>
        <AdminSearchForm
          search={data.search}
          action="/admin/assessments"
          filters={[{
            name: "publication",
            label: "Publication",
            value: data.publication,
            options: [
              { value: "published", label: "Published" },
              { value: "unpublished", label: "Unpublished" },
            ],
          }]}
        />
        {data.assessments.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Assessment</th><th>Course</th><th>Instructor</th><th>Questions</th><th>Attempts</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td><Link href={`/admin/assessments/${assessment.id}`}>{assessment.title}</Link><small>{assessment.assessment_type.toLowerCase()} · {formatAdminDate(assessment.created_at)}</small></td>
                    <td><Link href={`/admin/courses/${assessment.course_id}`}>{assessment.course_title}</Link></td>
                    <td><Link href={`/admin/instructors/${assessment.instructor_id}`}>{assessment.instructor_name}</Link></td>
                    <td>{assessment.question_count}</td>
                    <td>{assessment.attempt_count}</td>
                    <td><AdminStatus value={assessment.is_published ? "PUBLISHED" : "UNPUBLISHED"} /></td>
                    <td><Link className="admin-inline-link" href={`/admin/assessments/${assessment.id}`}>Inspect <span aria-hidden="true">→</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <AdminEmptyState title="No assessments found" description="Try another search or publication filter." />}
        <AdminPagination page={data.page} pageSize={data.pageSize} total={data.total} searchParams={{ q: data.search, publication: data.publication }} />
      </AdminPanel>
    </div>
  );
}
