import { connection } from "next/server";
import { Suspense } from "react";
import StudentPortalShell from "@/components/student/student-portal-shell";
import { getStudentShellData } from "@/lib/student/data";
import "./student.css";

function PortalAccessFallback() {
  return (
    <main className="portal-placeholder" aria-busy="true">
      <p className="auth-loading">Checking account access…</p>
    </main>
  );
}

export default function StudentLayout({ children }) {
  return (
    <Suspense fallback={<PortalAccessFallback />}>
      <VerifiedStudent>{children}</VerifiedStudent>
    </Suspense>
  );
}

async function VerifiedStudent({ children }) {
  await connection();
  const { identity, profile, unreadCount } = await getStudentShellData();
  return (
    <StudentPortalShell profile={profile} userId={identity.id} unreadCount={unreadCount}>
      {children}
    </StudentPortalShell>
  );
}
