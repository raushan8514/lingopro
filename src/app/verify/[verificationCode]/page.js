import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCertificateIssueDate } from "@/lib/certificates/date";
import "./verify.css";

export const metadata = {
  title: "Certificate verification",
  robots: { index: false, follow: false },
};

export const instant = false;

const CODE_PATTERN = /^[0-9a-f]{32}$/i;

export default async function CertificateVerificationPage({ params }) {
  const { verificationCode } = await params;
  if (!CODE_PATTERN.test(verificationCode || "")) notFound();

  const client = await createClient();
  const { data, error } = await client.rpc("verify_certificate", {
    target_verification_code: verificationCode,
  });
  if (error) {
    console.error("Unable to verify certificate.", {
      code: error.code,
      status: error.status,
      name: error.name,
    });
    throw new Error("Certificate verification is temporarily unavailable.");
  }

  const certificate = data?.[0];
  if (!certificate) {
    return (
      <main className="certificate-verification-page">
        <section className="certificate-verification-card" aria-labelledby="verification-title">
          <ShieldAlert className="is-invalid" size={32} aria-hidden="true" />
          <p className="student-eyebrow">LingoPro certificate registry</p>
          <h1 id="verification-title">Certificate not found</h1>
          <p>
            This verification code does not match an issued certificate. Check the
            code and try again.
          </p>
          <Link href="/">Return to LingoPro</Link>
        </section>
      </main>
    );
  }

  const isIssued = certificate.status === "ISSUED";
  return (
    <main className="certificate-verification-page">
      <section
        className="certificate-verification-card"
        aria-labelledby="verification-title"
        data-status={isIssued ? "issued" : "revoked"}
      >
        {isIssued ? (
          <BadgeCheck size={34} aria-hidden="true" />
        ) : (
          <ShieldAlert className="is-revoked" size={34} aria-hidden="true" />
        )}
        <p className="student-eyebrow">LingoPro certificate registry</p>
        <h1 id="verification-title">
          {isIssued ? "Certificate verified" : "Certificate revoked"}
        </h1>
        <p>
          {isIssued
            ? "This certificate is an authentic LingoPro learning record."
            : "This certificate was revoked and is no longer valid."}
        </p>
        <dl>
          <div>
            <dt>Learner</dt>
            <dd>{certificate.student_name}</dd>
          </div>
          <div>
            <dt>Course</dt>
            <dd>{certificate.course_title}</dd>
          </div>
          <div>
            <dt>Certificate number</dt>
            <dd>{certificate.certificate_number}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{formatCertificateIssueDate(certificate.issued_at)}</dd>
          </div>
          {!isIssued && certificate.revoked_at && (
            <div>
              <dt>Revoked</dt>
              <dd>{formatCertificateIssueDate(certificate.revoked_at)}</dd>
            </div>
          )}
        </dl>
        <Link href="/">Return to LingoPro</Link>
      </section>
    </main>
  );
}
