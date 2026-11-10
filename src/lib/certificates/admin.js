import "server-only";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

function logCertificateReadFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

export async function getAdminCertificatesData({ query = "", status = "ALL" } = {}) {
  await requireRole("admin");
  const client = await createClient({ allowCookieWrites: false });
  let certificatesQuery = client
    .from("certificates")
    .select(
      "id,student_id,course_id,enrollment_id,certificate_number,issued_at,status,revoked_at,revoked_by,revocation_reason,student:profiles!certificates_student_id_fkey!inner(full_name),course:courses!certificates_course_id_fkey!inner(title)",
    )
    .order("issued_at", { ascending: false })
    .limit(100);

  if (status === "ISSUED" || status === "REVOKED") {
    certificatesQuery = certificatesQuery.eq("status", status);
  }
  if (query) {
    certificatesQuery = certificatesQuery.ilike(
      "certificate_number",
      `%${query.slice(0, 100)}%`,
    );
  }

  const { data: certificates, error: certificatesError } = await certificatesQuery;

  if (certificatesError) {
    logCertificateReadFailure("load administrator certificate records", certificatesError);
    throw new Error("Certificate oversight data could not be loaded.");
  }

  const certificateIds = (certificates || []).map((certificate) => certificate.id);
  const eventsResult = certificateIds.length
    ? await client
        .from("certificate_events")
        .select(
          "id,certificate_id,actor_id,event_type,reason,created_at,actor:profiles!certificate_events_actor_id_fkey(full_name)",
        )
        .in("certificate_id", certificateIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  const { data: events, error: eventsError } = eventsResult;

  if (eventsError) {
    logCertificateReadFailure("load certificate audit history", eventsError);
    throw new Error("Certificate audit history could not be loaded.");
  }

  const eventByCertificate = new Map();
  for (const event of events || []) {
    const list = eventByCertificate.get(event.certificate_id) || [];
    list.push({
      ...event,
      actor: Array.isArray(event.actor) ? event.actor[0] : event.actor,
    });
    eventByCertificate.set(event.certificate_id, list);
  }

  return {
    query,
    status,
    certificates: (certificates || []).map((certificate) => ({
      ...certificate,
      student: Array.isArray(certificate.student)
        ? certificate.student[0]
        : certificate.student,
      course: Array.isArray(certificate.course)
        ? certificate.course[0]
        : certificate.course,
      events: eventByCertificate.get(certificate.id) || [],
    })),
  };
}
