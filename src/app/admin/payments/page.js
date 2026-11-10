import Link from "next/link";
import { CreditCard } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-components";
import { getAdminPayments } from "@/lib/payments/admin";
import { formatMinorCurrency } from "@/lib/payments/format";

export const metadata = {
  title: "Payments",
  robots: { index: false, follow: false },
};

function date(value) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Not paid";
}

function pageUrl({ page, search, status }) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/payments${query ? `?${query}` : ""}`;
}

export default async function AdminPaymentsPage({ searchParams }) {
  const params = await searchParams;
  const search = String(params.q || "").trim().slice(0, 100);
  const status = ["PENDING", "AUTHORIZED", "SUCCEEDED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]
    .includes(String(params.status || "").toUpperCase())
    ? String(params.status).toUpperCase()
    : "";
  const data = await getAdminPayments({ search, status, page: params.page });
  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="Billing operations"
        title="Payments"
        description="Read-only provider transaction visibility. Payment status cannot be manually changed and refunds are not exposed here."
      />
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Transaction records</p>
            <h2>{data.total} matching payments</h2>
          </div>
          <CreditCard size={22} aria-hidden="true" />
        </div>
        <form className="admin-filter-form" method="get">
          <label>
            <span className="admin-sr-only">Search transaction references</span>
            <input
              className="ui-input"
              type="search"
              name="q"
              defaultValue={search}
              maxLength={100}
              placeholder="Transaction, order, payment, or subscription reference"
            />
          </label>
          <label>
            <span className="admin-sr-only">Filter payment status</span>
            <select className="ui-input ui-select" name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="AUTHORIZED">Authorized</option>
              <option value="SUCCEEDED">Successful</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
              <option value="PARTIALLY_REFUNDED">Partially refunded</option>
            </select>
          </label>
          <button className="admin-button admin-button-secondary" type="submit">Filter</button>
        </form>
        {data.records.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Student</th>
                  <th>Purchase</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment date</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((payment) => (
                  <tr key={payment.payment_id}>
                    <td>
                      {payment.transaction_reference || "—"}
                      <small>{payment.provider_order_id || payment.provider_payment_id || "Provider reference pending"}</small>
                    </td>
                    <td><Link href={`/admin/users/${payment.student_id}`}>{payment.student_id}</Link></td>
                    <td>{payment.purchase_description || "Purchase"}</td>
                    <td>{formatMinorCurrency(payment.amount_cents, payment.currency)}</td>
                    <td>{payment.payment_status}</td>
                    <td>{date(payment.paid_at || payment.created_at)}</td>
                    <td>
                      {payment.receipt_number
                        ? <Link href={`/api/payments/${encodeURIComponent(payment.payment_id)}/receipt`}>View</Link>
                        : "—"}
                      {payment.failure_description && (
                        <small>{payment.failure_code ? `${payment.failure_code}: ` : ""}{payment.failure_description}</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty-copy">No payment records match these filters.</p>
        )}
        {totalPages > 1 && (
          <nav className="admin-pagination" aria-label="Payment pages">
            <span>Page {data.page} of {totalPages}</span>
            <div>
              <Link
                href={pageUrl({ page: Math.max(1, data.page - 1), search, status })}
                aria-disabled={data.page <= 1}
                tabIndex={data.page <= 1 ? -1 : undefined}
              >
                Previous
              </Link>
              <Link
                href={pageUrl({ page: Math.min(totalPages, data.page + 1), search, status })}
                aria-disabled={data.page >= totalPages}
                tabIndex={data.page >= totalPages ? -1 : undefined}
              >
                Next
              </Link>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
