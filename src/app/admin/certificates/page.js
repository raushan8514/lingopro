import { Award, Search } from "lucide-react";
import {
  AdminCertificateRevocationForm,
} from "@/components/admin/admin-forms";
import {
  AdminPageHeader,
  AdminPanel,
  AdminStatus,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminCertificatesData } from "@/lib/certificates/admin";
import { formatCertificateIssueDate } from "@/lib/certificates/date";

export const metadata = {
  title: "Certificate oversight",
  robots: { index: false, follow: false },
};

export default async function AdminCertificatesPage({ searchParams }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status = ["ISSUED", "REVOKED"].includes(params.status)
    ? params.status
    : "ALL";
  const data = await getAdminCertificatesData({ query, status });

  return (
    <div className="student-page admin-page">
      <AdminPageHeader
        eyebrow="Learner records"
        title="Certificates"
        description="Review issued records, inspect immutable lifecycle history, and revoke invalid credentials with a required reason."
      />
      <AdminPanel eyebrow="Registry" title="Certificate records">
        <form className="admin-filter-form" method="get">
          <label className="admin-search-field">
            <span className="admin-sr-only">Search certificate number</span>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              name="q"
              maxLength={100}
              defaultValue={query}
              placeholder="Search certificate number"
            />
          </label>
          <label className="admin-sr-only" htmlFor="certificate-status">Status</label>
          <select
            id="certificate-status"
            name="status"
            defaultValue={status}
            className="ui-input ui-select"
          >
            <option value="ALL">All statuses</option>
            <option value="ISSUED">Issued</option>
            <option value="REVOKED">Revoked</option>
          </select>
          <button className="admin-button admin-button-secondary" type="submit">
            Apply filters
          </button>
        </form>

        {data.certificates.length ? (
          <div className="admin-record-list">
            {data.certificates.map((certificate) => (
              <article className="admin-record-row admin-certificate-record" key={certificate.id}>
                <div className="admin-certificate-record-main">
                  <div className="admin-certificate-record-heading">
                    <Award size={18} aria-hidden="true" />
                    <strong>{certificate.certificate_number}</strong>
                    <AdminStatus value={certificate.status} />
                  </div>
                  <p>{certificate.student?.full_name || "Learner"} · {certificate.course?.title || "Course"}</p>
                  <p>Issued {formatCertificateIssueDate(certificate.issued_at)}</p>
                  {certificate.revocation_reason && (
                    <p className="admin-form-note">
                      Revocation reason: {certificate.revocation_reason}
                    </p>
                  )}
                  {certificate.events.length > 0 && (
                    <details className="admin-certificate-history">
                      <summary>Lifecycle history ({certificate.events.length})</summary>
                      <ol>
                        {certificate.events.map((event) => (
                          <li key={event.id}>
                            <strong>{event.event_type}</strong>
                            <span>{formatAdminDate(event.created_at, { time: true })}</span>
                            <span>{event.actor?.full_name || "Former account"}</span>
                            {event.reason && <p>{event.reason}</p>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
                {certificate.status === "ISSUED" && (
                  <AdminCertificateRevocationForm certificate={certificate} />
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-form-note">No certificate records match these filters.</p>
        )}
      </AdminPanel>
    </div>
  );
}
