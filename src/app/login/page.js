import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import AuthShell from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { getSafeInternalPath } from "@/lib/auth/paths";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Log in",
  robots: { index: false, follow: false },
};

const statusMessages = {
  "setup-required":
    "Authentication is not configured. Add the Supabase project URL and anonymous key to enable account access.",
  "service-unavailable":
    "We couldn't verify your session right now. Please try again shortly.",
  "profile-unavailable":
    "We couldn't verify your profile. Protected areas remain unavailable.",
  "callback-error":
    "That sign-in link could not be verified or has expired. Try again or request a new email.",
  "email-verified":
    "Your email is verified. Sign in to continue.",
  "password-updated":
    "Your password was updated. Sign in with your new password.",
};

function AuthFallback() {
  return (
    <main className="auth-page" aria-busy="true">
      <p className="auth-loading">Loading secure account access…</p>
    </main>
  );
}

export default function LoginPage({ searchParams }) {
  return (
    <Suspense fallback={<AuthFallback />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }) {
  await connection();
  const params = await searchParams;
  const nextPath = getSafeInternalPath(params?.next, "");
  const status = params?.status;
  const notice = statusMessages[status] || (
    !isSupabaseConfigured()
      ? "Supabase authentication is not configured yet. Public pages remain available."
      : ""
  );

  return (
    <AuthShell
      eyebrow="WELCOME BACK"
      title="Good to see you again."
      description="Sign in to continue your LingoPro journey."
      notice={notice ? <p className="auth-notice" role="status">{notice}</p> : null}
      footer={(
        <p>
          New to LingoPro? <Link href="/register">Create a student account</Link>
        </p>
      )}
    >
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
