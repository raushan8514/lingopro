import { connection } from "next/server";
import { Suspense } from "react";
import StudentPortalShell from "@/components/student/student-portal-shell";
import { getInstructorProfile } from "@/lib/instructor/data";
import { getPortalUnreadNotificationCount } from "@/lib/notifications/data";
import "../student/student.css";
import "./instructor.css";

function PortalAccessFallback() {
  return (
    <main className="portal-placeholder" aria-busy="true">
      <p className="auth-loading">Checking account access…</p>
    </main>
  );
}

export default function InstructorLayout({ children }) {
  return (
    <Suspense fallback={<PortalAccessFallback />}>
      <VerifiedInstructor>{children}</VerifiedInstructor>
    </Suspense>
  );
}

async function VerifiedInstructor({ children }) {
  await connection();
  const [{ identity, profile }, unreadCount] = await Promise.all([
    getInstructorProfile(),
    getPortalUnreadNotificationCount("instructor"),
  ]);
  return (
    <StudentPortalShell
      role="instructor"
      profile={{ ...profile, email: identity.email }}
      userId={profile.id}
      unreadCount={unreadCount}
    >
      {children}
    </StudentPortalShell>
  );
}
