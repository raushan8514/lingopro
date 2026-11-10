import Link from "next/link";
import { ReceiptText, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StudentPageHeader } from "@/components/student/student-components";
import { getStudentSubscriptionAndTransactions } from "@/lib/payments/student";
import { formatMinorCurrency } from "@/lib/payments/format";
import CoursePaymentReconcileForm from "@/components/payments/course-payment-reconcile-form";

export const metadata = {
  title: "Transactions",
  robots: { index: false, follow: false },
};

const statusLabels = {
  PENDING: "Pending",
  AUTHORIZED: "Authorized",
  SUCCEEDED: "Successful",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
};

function date(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function pageUrl(page) {
  return `/student/transactions?page=${page}`;
}

export default async function StudentTransactionsPage({ searchParams }) {
  const params = await searchParams;
  const requestedPage = /^\d+$/.test(String(params.page || ""))
    ? Number(params.page)
    : 1;
  const {
    payments,
    paymentTotal,
    paymentPage,
    paymentPageCount,
  } = await getStudentSubscriptionAndTransactions(requestedPage);

  return (
    <div className="student-page billing-page">
      <StudentPageHeader
        eyebrow="Billing"
        title="Transactions"
        description="Your payment records are private to your account. Access is shown only after verified provider confirmation."
      />
      <section className="billing-panel">
        <div className="billing-panel-heading">
          <div>
            <span className="student-section-kicker">Payment history</span>
            <h2>{paymentTotal} transaction{paymentTotal === 1 ? "" : "s"}</h2>
          </div>
          <WalletCards size={22} aria-hidden="true" />
        </div>
        {payments.length ? (
          <div className="billing-transactions">
            {payments.map((payment) => (
              <article className="billing-transaction-row" key={payment.id}>
                <div className="billing-transaction-icon">
                  <ReceiptText size={19} aria-hidden="true" />
                </div>
                <div className="billing-transaction-main">
                  <h3>{payment.purchase_description || "LingoPro purchase"}</h3>
                  <p>
                    {payment.transaction_reference || payment.provider_order_id || "Transaction"}
                    {" · "}
                    {date(payment.paid_at || payment.created_at)}
                  </p>
                  {payment.failure_description && payment.status === "FAILED" && (
                    <p className="billing-failure-note">
                      {payment.failure_code ? `${payment.failure_code}: ` : ""}
                      {payment.failure_description}
                    </p>
                  )}
                  {payment.payment_method && (
                    <p>Method: {payment.payment_method}</p>
                  )}
                  {payment.course_id &&
                    ["PENDING", "AUTHORIZED"].includes(payment.status) && (
                      <CoursePaymentReconcileForm paymentId={payment.id} />
                    )}
                </div>
                <div className="billing-transaction-total">
                  <strong>{formatMinorCurrency(payment.amount_cents, payment.currency)}</strong>
                  <Badge variant={payment.status === "SUCCEEDED" ? "success" : payment.status === "FAILED" ? "error" : "warning"}>
                    {statusLabels[payment.status] || payment.status}
                  </Badge>
                  {payment.receipt_number && payment.status === "SUCCEEDED" && (
                    <Link href={`/api/payments/${encodeURIComponent(payment.id)}/receipt`}>
                      View receipt
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="billing-empty-state">
            <ReceiptText size={23} aria-hidden="true" />
            <h3>No transactions yet</h3>
            <p>Verified course purchases and subscription charges will appear here.</p>
            <Link className="market-text-action" href="/courses">Browse courses</Link>
          </div>
        )}
        {paymentPageCount > 1 && (
          <nav className="billing-pagination" aria-label="Transaction pages">
            <span>Page {paymentPage} of {paymentPageCount}</span>
            <div>
              {paymentPage > 1
                ? <Link href={pageUrl(paymentPage - 1)}>Previous</Link>
                : <span aria-disabled="true">Previous</span>}
              {paymentPage < paymentPageCount
                ? <Link href={pageUrl(paymentPage + 1)}>Next</Link>
                : <span aria-disabled="true">Next</span>}
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
