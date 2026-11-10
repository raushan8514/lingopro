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
import { getAdminInstructors } from "@/lib/admin/data";

export const metadata = { title: "Instructor management", robots: { index: false, follow: false } };

export default async function AdminInstructorsPage({ searchParams }) {
  const params = await searchParams;
  const data = await getAdminInstructors(params);
  return (
    <div className="student-page admin-page">
      <AdminPageHeader eyebrow="Teaching accounts" title="Instructor management" description="Review instructor profiles, their course portfolio, and recent teaching activity." />
      <AdminPanel>
        <AdminSearchForm search={data.search} action="/admin/instructors" />
        {data.users.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Instructor</th><th>Email</th><th>Courses</th><th>Registered</th><th>Role</th><th /></tr></thead>
              <tbody>
                {data.users.map((instructor) => (
                  <tr key={instructor.id}>
                    <td><Link href={`/admin/instructors/${instructor.id}`}>{instructor.full_name}</Link></td>
                    <td>{instructor.email}</td>
                    <td>{instructor.courseCount}</td>
                    <td>{formatAdminDate(instructor.created_at)}</td>
                    <td><AdminStatus value={instructor.role} /></td>
                    <td><Link className="admin-inline-link" href={`/admin/instructors/${instructor.id}`}>Review <span aria-hidden="true">→</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <AdminEmptyState title="No instructors found" description="Instructor accounts appear here after their trusted role has been assigned." />}
        <AdminPagination page={data.page} pageSize={data.pageSize} total={data.total} searchParams={{ q: data.search }} />
      </AdminPanel>
      <p className="admin-capability-note">The current database has no instructor application or approval model. Instructor privilege changes use the audited role-management workflow; applications are not fabricated.</p>
    </div>
  );
}
