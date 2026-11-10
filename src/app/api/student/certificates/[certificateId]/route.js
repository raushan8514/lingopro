import { createClient } from "@/lib/supabase/server";
import { createCertificatePdf } from "@/lib/certificates/pdf";
import { getAppBaseUrl } from "@/lib/supabase/env";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logCertificateFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    name: error?.name,
    status: error?.status ?? error?.statusCode,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

export async function GET(request, { params }) {
  const { certificateId } = await params;
  if (!UUID_PATTERN.test(certificateId || "")) {
    return new Response("Certificate not found.", { status: 404 });
  }

  const client = await createClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) {
    logCertificateFailure("verify certificate download access", authError);
    if (authError.name === "AuthSessionMissingError") {
      return new Response("Sign in to download this certificate.", { status: 401 });
    }
    return new Response("Certificate access could not be verified.", { status: 503 });
  }
  if (!authData.user) {
    return new Response("Sign in to download this certificate.", { status: 401 });
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    logCertificateFailure("load certificate download permissions", profileError);
    return new Response("Certificate access could not be verified.", { status: 503 });
  }
  if (profile?.role !== "student") {
    return new Response("This certificate is not available to this account.", { status: 403 });
  }

  const { data: certificate, error } = await client
    .from("certificates")
    .select(
      "id,certificate_number,verification_code,issued_at,student_id,status,course:courses!certificates_course_id_fkey!inner(title),student:profiles!certificates_student_id_fkey!inner(full_name)",
    )
    .eq("id", certificateId)
    .eq("student_id", authData.user.id)
    .maybeSingle();

  if (error) {
    logCertificateFailure("load the requested certificate", error);
    return new Response("The certificate could not be loaded.", { status: 503 });
  }
  if (!certificate) {
    return new Response("Certificate not found.", { status: 404 });
  }
  if (certificate.status !== "ISSUED") {
    return new Response("This certificate has been revoked and cannot be downloaded.", {
      status: 410,
    });
  }

  const course = Array.isArray(certificate.course)
    ? certificate.course[0]
    : certificate.course;
  const student = Array.isArray(certificate.student)
    ? certificate.student[0]
    : certificate.student;
  if (!course?.title || !student?.full_name) {
    return new Response("The certificate record is incomplete.", { status: 500 });
  }

  try {
    const pdf = await createCertificatePdf({
      studentName: student.full_name,
      courseTitle: course.title,
      certificateNumber: certificate.certificate_number,
      issuedAt: certificate.issued_at,
      verificationUrl: new URL(
        `/verify/${certificate.verification_code}`,
        getAppBaseUrl(),
      ).toString(),
    });

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="LingoPro-Certificate-${certificate.certificate_number.replace(/[^A-Za-z0-9-]/g, "-")}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (generationError) {
    logCertificateFailure("generate the certificate PDF", generationError);
    return new Response("The certificate PDF could not be generated.", { status: 500 });
  }
}
