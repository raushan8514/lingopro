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
import { getAdminUsers } from "@/lib/admin/data";

export const metadata = { title: "User management", robots: { index: false, follow: false } };

export default async function AdminUsersPage({ searchParams }) {
  const params = await searchParams;
  const data = await getAdminUsers(params);
  return (
    <div className="student-page admin-page">
      <AdminPageHeader eyebrow="Accounts" title="User management" description="Review account profiles, registration details, roles, and learning relationships." />
      <AdminPanel>
        <AdminSearchForm
          search={data.search}
          action="/admin/users"
          filters={[{
            name: "role",
            label: "Role",
            value: data.role,
            options: [
              { value: "student", label: "Student" },
              { value: "instructor", label: "Instructor" },
              { value: "admin", label: "Administrator" },
            ],
          }]}
        />
        {data.users.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Registered</th><th /></tr></thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td><Link href={`/admin/users/${user.id}`}>{user.full_name}</Link></td>
                    <td>{user.email}</td>
                    <td><AdminStatus value={user.role} /></td>
                    <td>{formatAdminDate(user.created_at)}</td>
                    <td><Link className="admin-inline-link" href={`/admin/users/${user.id}`}>View <span aria-hidden="true">→</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState title="No matching users" description="Try another search or role filter." />
        )}
        <AdminPagination page={data.page} pageSize={data.pageSize} total={data.total} searchParams={{ q: data.search, role: data.role }} />
      </AdminPanel>
      <p className="admin-capability-note">Account suspension and Auth-user deletion are not supported by the current authentication architecture. No password, session, or token data is exposed here.</p>
    </div>
  );
}
