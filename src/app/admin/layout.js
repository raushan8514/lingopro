import { connection } from "next/server";
import { Suspense } from "react";
import StudentPortalShell from "@/components/student/student-portal-shell";
import { getAdminProfile } from "@/lib/admin/data";
import { getPortalUnreadNotificationCount } from "@/lib/notifications/data";
import "../student/student.css";
import "./admin.css";

function PortalAccessFallback() {
  return (
    <main className="portal-placeholder" aria-busy="true">
      <p className="auth-loading">Checking account access…</p>
    </main>
  );
}

export default function AdminLayout({ children }) {
  return (
    <Suspense fallback={<PortalAccessFallback />}>
      <VerifiedAdmin>{children}</VerifiedAdmin>
    </Suspense>
  );
}

async function VerifiedAdmin({ children }) {
  await connection();
  const [{ identity, profile }, unreadCount] = await Promise.all([
    getAdminProfile(),
    getPortalUnreadNotificationCount("admin"),
  ]);
  return (
    <StudentPortalShell
      role="admin"
      profile={{ ...profile, email: identity.email }}
      userId={profile.id}
      unreadCount={unreadCount}
    >
      {children}
    </StudentPortalShell>
  );
}
