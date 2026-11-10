import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import AuthShell from "@/components/auth/auth-shell";
import { RegisterForm, ResendVerificationForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

function AuthFallback() {
  return (
    <main className="auth-page" aria-busy="true">
      <p className="auth-loading">Loading secure account access…</p>
    </main>
  );
}

export default function RegisterPage({ searchParams }) {
  return (
    <Suspense fallback={<AuthFallback />}>
      <RegisterContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RegisterContent({ searchParams }) {
  await connection();
  const params = await searchParams;
  const needsVerification = params?.status === "check-email";
  const setupNotice = !isSupabaseConfigured()
    ? "Supabase authentication is not configured yet. You can review this form, but accounts cannot be created until the project keys are added."
    : null;

  return (
    <AuthShell
      eyebrow={needsVerification ? "CHECK YOUR INBOX" : "START YOUR JOURNEY"}
      title={needsVerification ? "Verify your email." : "Create your account."}
      description={
        needsVerification
          ? "Use the confirmation link in your email to activate your student account."
          : "A few details are all you need to get started."
      }
      notice={(
        <>
          {setupNotice && <p className="auth-notice" role="status">{setupNotice}</p>}
          {needsVerification && (
            <p className="auth-notice auth-notice-success" role="status">
              Your account is not active until your email address is verified. If an account was created, a confirmation email is on its way.
            </p>
          )}
        </>
      )}
      footer={(
        <p>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      )}
    >
      {needsVerification ? <ResendVerificationForm /> : <RegisterForm />}
    </AuthShell>
  );
}
