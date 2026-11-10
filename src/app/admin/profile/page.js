import { AdminPageHeader, AdminPanel, formatAdminDate } from "@/components/admin/admin-components";
import { getAdminProfile } from "@/lib/admin/data";

export const metadata = { title: "Administrator profile", robots: { index: false, follow: false } };

export default async function AdminProfilePage() {
  const { identity, profile } = await getAdminProfile();
  return (
    <div className="student-page admin-page">
      <AdminPageHeader eyebrow="Administrator account" title="Your profile" description="Your verified account identity and privileged platform role." />
      <AdminPanel eyebrow="Authenticated profile" title={profile.full_name}>
        <dl className="admin-detail-list">
          <div><dt>Email</dt><dd>{identity.email}</dd></div>
          <div><dt>Role</dt><dd>Administrator</dd></div>
          <div><dt>Account created</dt><dd>{formatAdminDate(profile.created_at)}</dd></div>
          <div><dt>User identifier</dt><dd className="admin-mono">{identity.id}</dd></div>
        </dl>
        <p className="admin-capability-note">Profile and administrator access are provisioned through the trusted account-management workflow. Public registration cannot grant this role.</p>
      </AdminPanel>
    </div>
  );
}
