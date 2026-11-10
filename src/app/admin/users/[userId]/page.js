import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminRoleForm } from "@/components/admin/admin-forms";
import {
  AdminPageHeader,
  AdminPanel,
  AdminStatus,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminProfile, getAdminUser } from "@/lib/admin/data";

export const metadata = { title: "User details", robots: { index: false, follow: false } };

export default async function AdminUserDetailPage({ params }) {
  const { userId } = await params;
  const [{ profile, enrollments, courses }, admin] = await Promise.all([
    getAdminUser(userId),
    getAdminProfile(),
  ]);
  return (
    <div className="student-page admin-page">
      <Link className="admin-back-link" href="/admin/users"><ArrowLeft size={15} /> Back to users</Link>
      <AdminPageHeader
        eyebrow="Account details"
        title={profile.full_name}
        description={`Registered ${formatAdminDate(profile.created_at)} · Last profile update ${formatAdminDate(profile.updated_at)}`}
      />
      <div className="admin-detail-grid">
        <AdminPanel eyebrow="Verified profile" title="Account information">
          <dl className="admin-detail-list">
            <div><dt>Email</dt><dd>{profile.email}</dd></div>
            <div><dt>Account ID</dt><dd className="admin-mono">{profile.id}</dd></div>
            <div><dt>Role</dt><dd><AdminStatus value={profile.role} /></dd></div>
            <div><dt>Avatar</dt><dd>{profile.avatar_url ? <a href={profile.avatar_url} target="_blank" rel="noreferrer">Open profile image</a> : "Not provided"}</dd></div>
          </dl>
        </AdminPanel>
        <AdminPanel eyebrow="Trusted workflow" title="Role management">
          <p className="admin-capability-note">Role changes use the server-verified administrator RPC and are written to the audit log. Admin roles are not self-service.</p>
          <AdminRoleForm user={profile} currentUserId={admin.identity.id} />
        </AdminPanel>
      </div>
      {profile.role === "instructor" && (
        <AdminPanel eyebrow="Instructor relationships" title={`Courses (${courses.length})`}>
          {courses.length ? (
            <div className="admin-record-list">
              {courses.map((course) => (
                <article className="admin-record-row" key={course.id}>
                  <div><Link href={`/admin/courses/${course.id}`}>{course.title}</Link><p>{course.language} · Updated {formatAdminDate(course.updated_at)}</p></div>
                  <AdminStatus value={course.status} />
                </article>
              ))}
            </div>
          ) : <p className="admin-muted">This instructor has no courses yet.</p>}
        </AdminPanel>
      )}
      {profile.role === "student" && (
        <AdminPanel eyebrow="Learning relationships" title={`Enrollments (${enrollments.length})`}>
          {enrollments.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Course</th><th>Status</th><th>Type</th><th>Enrolled</th></tr></thead>
                <tbody>
                  {enrollments.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td><Link href={`/admin/courses/${enrollment.course_id}`}>{enrollment.courses?.title || "Course record"}</Link></td>
                      <td><AdminStatus value={enrollment.status} /></td>
                      <td>{enrollment.enrollment_type.toLowerCase().replaceAll("_", " ")}</td>
                      <td>{formatAdminDate(enrollment.enrolled_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="admin-muted">No enrollment history is available for this account.</p>}
        </AdminPanel>
      )}
    </div>
  );
}
