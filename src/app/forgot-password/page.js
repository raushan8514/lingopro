import Link from "next/link";
import AuthShell from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  const notice = isSupabaseConfigured()
    ? null
    : "Supabase authentication is not configured yet. Recovery emails cannot be sent until the project keys are added.";

  return (
    <AuthShell
      eyebrow="ACCOUNT RECOVERY"
      title="Reset your password."
      description="Enter your account email and we’ll send instructions if an account is registered with it."
      notice={notice ? <p className="auth-notice" role="status">{notice}</p> : null}
      footer={(
        <p>
          Remembered your password? <Link href="/login">Back to sign in</Link>
        </p>
      )}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
