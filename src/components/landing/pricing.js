import { Suspense } from "react";
import { ArrowRight, CircleHelp } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import ActionLink from "@/components/landing/action-link";
import SectionHeading from "@/components/landing/section-heading";
import { getPublicSubscriptionPlans } from "@/lib/payments/public";
import { formatMinorCurrency } from "@/lib/payments/format";

export default function Pricing() {
  return (
    <section className="landing-section pricing-section" id="pricing" aria-labelledby="pricing-title">
      <div className="landing-container">
        <SectionHeading
          id="pricing-title"
          eyebrow="Current subscription plans"
          title="A plan for every kind of learner."
          description="Review the current subscription terms configured by LingoPro."
          align="center"
        />
        <Suspense fallback={<PricingState>Loading configured subscription plans…</PricingState>}>
          <PricingPlans />
        </Suspense>
      </div>
    </section>
  );
}

async function PricingPlans() {
  const result = await getPublicSubscriptionPlans();
  if (result.status !== "ready") {
    const message = {
      unconfigured: "Subscription pricing is unavailable until the platform database is configured.",
      unavailable: "We couldn’t load subscription pricing right now. Please try again later.",
      misconfigured: "There are no checkout-ready plans at the moment. Please check back later.",
      empty: "Subscription plans are not currently available.",
    }[result.status];
    return <PricingState>{message}</PricingState>;
  }

  return (
    <>
      <div className="pricing-grid">
        {result.plans.map((plan) => (
          <Card className="pricing-card" key={plan.id}>
            <CardContent>
              <div className="pricing-card-heading">
                <h3>{plan.name}</h3>
              </div>
              {plan.description && <p className="pricing-description">{plan.description}</p>}
              <div className="pricing-price">
                <strong>{formatMinorCurrency(plan.price_cents, plan.currency)}</strong>
                <span>{formatInterval(plan.interval_count, plan.billing_interval)}</span>
              </div>
              <p className="pricing-terms">
                Billed for {plan.billing_cycles} {plan.billing_cycles === 1 ? "cycle" : "cycles"}.
                The subscription ends after the configured term unless you start another.
              </p>
              <ActionLink
                href="/student/subscription"
                variant="outline"
                className="pricing-cta"
                rightIcon={<ArrowRight size={15} />}
              >
                View subscription options
              </ActionLink>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="pricing-note" id="pricing-note">
        <CircleHelp size={15} aria-hidden="true" />
        <span>Prices and terms are shown as configured. Course access is not included unless explicitly stated.</span>
      </p>
    </>
  );
}

function PricingState({ children }) {
  return (
    <div className="pricing-state" role="status" aria-live="polite">
      <CircleHelp size={18} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

function formatInterval(count, interval) {
  const unit = interval === "YEAR" ? "year" : "month";
  return `per ${count > 1 ? `${count} ` : ""}${unit}${count > 1 ? "s" : ""}`;
}
