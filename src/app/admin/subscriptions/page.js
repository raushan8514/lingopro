import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/admin-components";
import SubscriptionPlanForm from "@/components/admin/subscription-plan-form";
import { getAdminSubscriptions } from "@/lib/payments/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/server";
import SubscriptionPlanDeactivateForm from "@/components/admin/subscription-plan-deactivate-form";
import SubscriptionPlanMetadataForm from "@/components/admin/subscription-plan-metadata-form";
import { formatMinorCurrency } from "@/lib/payments/format";

export const metadata = {
  title: "Subscriptions",
  robots: { index: false, follow: false },
};

function date(value) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

async function getPlans() {
  await requireRole("admin");
  const client = await createClient({ allowCookieWrites: false });
  const { data, error } = await client
    .from("subscription_plans")
    .select("id,name,slug,description,price_cents,currency,billing_interval,interval_count,billing_cycles,is_active,razorpay_plan_id,razorpay_plan_mode")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Unable to load subscription plans.", {
      code: error.code,
      status: error.status,
    });
    throw new Error("Subscription plans are unavailable.");
  }
  return data || [];
}

export default async function AdminSubscriptionsPage() {
  const [subscriptions, plans] = await Promise.all([
    getAdminSubscriptions(),
    getPlans(),
  ]);

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="Billing operations"
        title="Subscriptions"
        description="Review provider-confirmed subscription states and configure explicitly priced, finite billing plans. New plans remain inactive until an administrator activates them."
      />

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Plan setup</p>
            <h2>Create a subscription plan</h2>
          </div>
        </div>
        <SubscriptionPlanForm />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Configured billing</p>
            <h2>Subscription plans</h2>
          </div>
        </div>
        {plans.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Billing term</th>
                  <th>Razorpay setup</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.name}<small>{plan.slug}</small></td>
                    <td>{formatMinorCurrency(plan.price_cents, plan.currency)}</td>
                    <td>
                      {plan.interval_count} {plan.billing_interval.toLowerCase()} interval(s)
                      <small>{plan.billing_cycles || "Cycle count required"} billing cycles</small>
                    </td>
                    <td>
                      {plan.razorpay_plan_id
                        ? `${plan.razorpay_plan_mode || "unknown"} provider plan linked`
                        : "Created on first checkout"}
                    </td>
                    <td>{plan.is_active ? "Active" : "Inactive"}</td>
                    <td>
                      <div className="admin-plan-actions">
                        <SubscriptionPlanDeactivateForm
                          planId={plan.id}
                          active={plan.is_active}
                        />
                        <SubscriptionPlanMetadataForm plan={plan} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty-copy">No subscription plans are configured.</p>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Customer records</p>
            <h2>Recent subscriptions</h2>
          </div>
          <CalendarClock size={22} aria-hidden="true" />
        </div>
        {subscriptions.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Subscriber</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Period</th>
                  <th>Renewal</th>
                  <th>Provider</th>
                  <th>Payments</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td><Link href={`/admin/users/${subscription.student_id}`}>{subscription.student_id}</Link></td>
                    <td>{subscription.subscription_plans?.name || subscription.plan_id}</td>
                    <td>
                      <Badge variant={subscription.status === "ACTIVE" ? "success" : "warning"}>
                        {subscription.status}
                      </Badge>
                    </td>
                    <td>{date(subscription.current_period_start)} – {date(subscription.current_period_end)}</td>
                    <td>{subscription.cancel_at_period_end ? "Cancellation at period end" : "Provider managed"}</td>
                    <td>{subscription.provider_subscription_id || subscription.provider}</td>
                    <td>
                      <Link href={`/admin/payments?q=${encodeURIComponent(subscription.id)}`}>
                        View payments
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty-copy">No subscription records yet.</p>
        )}
      </section>
      <p className="admin-status-strip">Payment and subscription status are read-only here. Provider credentials and payment instrument details are never displayed.</p>
    </div>
  );
}
