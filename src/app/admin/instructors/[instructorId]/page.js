import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminRoleForm } from "@/components/admin/admin-forms";
import {
  AdminPageHeader,
  AdminPanel,
  AdminStatus,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminProfile, getAdminUser } from "@/lib/admin/data";

export const metadata = { title: "Instructor details", robots: { index: false, follow: false } };

export default async function AdminInstructorDetailPage({ params }) {
  const { instructorId } = await params;
  const [{ profile, courses }, admin] = await Promise.all([
    getAdminUser(instructorId),
    getAdminProfile(),
  ]);
  if (profile.role !== "instructor") notFound();

  return (
    <div className="student-page admin-page">
      <Link className="admin-back-link" href="/admin/instructors"><ArrowLeft size={15} /> Back to instructors</Link>
      <AdminPageHeader
        eyebrow="Instructor review"
        title={profile.full_name}
        description={`${profile.email} · Account created ${formatAdminDate(profile.created_at)}`}
      />
      <AdminPanel eyebrow="Verified role" title="Instructor privileges">
        <p className="admin-capability-note">No application workflow exists in the current schema. Role changes are recorded in the administrator audit log and protected by database authorization.</p>
        <AdminRoleForm user={profile} currentUserId={admin.identity.id} />
      </AdminPanel>
      <AdminPanel eyebrow="Teaching portfolio" title={`Courses (${courses.length})`}>
        {courses.length ? (
          <div className="admin-record-list">
            {courses.map((course) => (
              <article className="admin-record-row" key={course.id}>
                <div>
                  <Link href={`/admin/courses/${course.id}`}>{course.title}</Link>
                  <p>{course.language} · {course.difficulty.toLowerCase()} · Updated {formatAdminDate(course.updated_at)}</p>
                </div>
                <AdminStatus value={course.status} />
              </article>
            ))}
          </div>
        ) : <p className="admin-muted">This instructor has no courses yet.</p>}
      </AdminPanel>
    </div>
  );
}
