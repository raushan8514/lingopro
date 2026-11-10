import Link from "next/link";
import AuthShell from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="SECURE YOUR ACCOUNT"
      title="Choose a new password."
      description="Use a new password you haven’t used on LingoPro before."
      footer={(
        <p>
          Need a fresh reset link? <Link href="/forgot-password">Request another</Link>
        </p>
      )}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
