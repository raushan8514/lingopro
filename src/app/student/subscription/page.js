import Link from "next/link";
import { CalendarClock, CreditCard, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { StudentPageHeader } from "@/components/student/student-components";
import RazorpayCheckoutButton from "@/components/payments/razorpay-checkout-button";
import { getStudentBillingData } from "@/lib/payments/student";
import SubscriptionCancelForm from "@/components/payments/subscription-cancel-form";
import { isRazorpayCheckoutAvailable } from "@/lib/payments/razorpay";
import { formatMinorCurrency } from "@/lib/payments/format";

export const metadata = {
  title: "Subscription",
  robots: { index: false, follow: false },
};

const subscriptionStatusLabels = {
  PENDING: "Pending confirmation",
  TRIALING: "Trialing",
  ACTIVE: "Active",
  PAST_DUE: "Payment needs attention",
  HALTED: "Halted",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

function date(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default async function StudentSubscriptionPage() {
  const { plans, subscriptions } = await getStudentBillingData();
  const checkoutAvailable = isRazorpayCheckoutAvailable();
  const current = subscriptions.find((subscription) =>
    ["PENDING", "TRIALING", "ACTIVE", "PAST_DUE", "HALTED", "PAUSED"].includes(
      subscription.status,
    ),
  );
  const purchasablePlans = plans.filter((plan) =>
    plan.price_cents > 0 &&
    ["MONTH", "YEAR"].includes(plan.billing_interval) &&
    Number.isInteger(plan.billing_cycles) &&
    plan.billing_cycles > 0,
  );

  return (
    <div className="student-page billing-page">
      <StudentPageHeader
        eyebrow="Billing"
        title="Subscription"
        description="Review provider-confirmed billing status and available subscription plans."
      />

      <section className="billing-panel">
        <div className="billing-panel-heading">
          <div>
            <span className="student-section-kicker">Your account</span>
            <h2>Current subscription</h2>
          </div>
          <CreditCard size={22} aria-hidden="true" />
        </div>
        {current ? (
          <div className="billing-current-subscription">
            <div className="billing-current-summary">
              <div>
                <h3>{current.subscription_plans?.name || "Subscription plan"}</h3>
                <p>
                  {current.subscription_plans
                    ? `${formatMinorCurrency(current.subscription_plans.price_cents, current.subscription_plans.currency)} · ${current.subscription_plans.billing_interval.toLowerCase()}`
                    : "Plan details are unavailable"}
                </p>
              </div>
              <Badge variant={current.status === "ACTIVE" ? "success" : "warning"}>
                {subscriptionStatusLabels[current.status] || current.status}
              </Badge>
            </div>
            <dl className="billing-facts">
              <div><dt>Started</dt><dd>{date(current.created_at)}</dd></div>
              <div><dt>Current period ends</dt><dd>{date(current.current_period_end)}</dd></div>
              <div>
                <dt>Renewal</dt>
                <dd>
                  {current.cancel_at_period_end
                    ? "Cancellation scheduled for period end"
                    : current.status === "ACTIVE"
                      ? "Renewal follows the configured plan term"
                      : "Not currently renewing"}
                </dd>
              </div>
              {current.cancelled_at && (
                <div><dt>Cancellation confirmed</dt><dd>{date(current.cancelled_at)}</dd></div>
              )}
            </dl>
            {current.cancel_at_period_end && (
              <Alert variant="information">
                Cancellation is scheduled. Razorpay-confirmed billing remains active until the recorded period end.
              </Alert>
            )}
            {["ACTIVE", "PAST_DUE", "HALTED", "PAUSED"].includes(current.status) &&
              !current.cancel_at_period_end && (
              <>
                <p className="billing-terms">
                  Cancellation is requested at the end of the current billing period. Your status changes only after Razorpay confirms the request.
                </p>
                <SubscriptionCancelForm subscriptionId={current.id} />
              </>
            )}
            {current.status === "PENDING" && (
              <Alert variant="warning">
                This subscription is not active until Razorpay confirms activation. Check back after provider notification.
              </Alert>
            )}
            {["PAST_DUE", "HALTED", "PAUSED"].includes(current.status) && (
              <Alert variant="warning">
                Review any failed charge in your{" "}
                <Link href="/student/transactions" className="market-text-action">
                  transaction history
                </Link>
                . If Razorpay requires a payment-method update, complete it only through a provider-approved secure flow.
              </Alert>
            )}
          </div>
        ) : (
          <div className="billing-empty-state">
            <CalendarClock size={23} aria-hidden="true" />
            <h3>No active subscription</h3>
            <p>Choose an available configured plan below, or continue with course purchases.</p>
          </div>
        )}
      </section>

      <section className="billing-panel">
        <div className="billing-panel-heading">
          <div>
            <span className="student-section-kicker">Available plans</span>
            <h2>Choose a billing plan</h2>
          </div>
          <ShieldCheck size={22} aria-hidden="true" />
        </div>
        {current ? (
          <Alert variant="information">
            Plan changes are not available while a subscription is active or awaiting confirmation.
          </Alert>
        ) : purchasablePlans.length ? (
          <>
            {!checkoutAvailable && (
              <Alert variant="warning">
                Subscription plans are configured, but Razorpay checkout is unavailable. Purchases cannot be started until the payment provider is configured.
              </Alert>
            )}
            <div className="billing-plan-grid">
              {purchasablePlans.map((plan) => (
                <article className="billing-plan-card" key={plan.id}>
                  <div>
                    <h3>{plan.name}</h3>
                    {plan.description && <p>{plan.description}</p>}
                  </div>
                  <p className="billing-plan-price">
                    <strong>{formatMinorCurrency(plan.price_cents, plan.currency)}</strong>
                    <span>per {plan.interval_count > 1 ? `${plan.interval_count} ` : ""}{plan.billing_interval.toLowerCase()}</span>
                  </p>
                  <p className="billing-terms">
                    Automatically renews for {plan.billing_cycles} billing cycles, then ends unless a new subscription is started.
                  </p>
                  {checkoutAvailable
                    ? (
                      <RazorpayCheckoutButton
                        kind="subscription"
                        targetId={plan.id}
                        label="Subscribe securely"
                      />
                    )
                    : <Button type="button" disabled>Checkout unavailable</Button>}
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="billing-empty-state">
            <p>
              No plans are ready for checkout. An administrator must configure an active monthly or annual plan, its price, currency, and billing-cycle count. No prices or terms are assumed.
            </p>
            <Link href="/courses" className="market-text-action">Explore courses</Link>
          </div>
        )}
      </section>
    </div>
  );
}
