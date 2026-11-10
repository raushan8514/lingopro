import "server-only";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function logPlanQueryFailure(error) {
  console.error("Unable to load public subscription plans.", {
    code: error?.code,
    status: error?.status,
    name: error?.name,
    message: typeof error?.message === "string" ? error.message.slice(0, 500) : undefined,
  });
}

function canCheckoutPlan(plan) {
  return (
    Number.isSafeInteger(plan.price_cents) &&
    plan.price_cents > 0 &&
    ["MONTH", "YEAR"].includes(plan.billing_interval) &&
    Number.isInteger(plan.interval_count) &&
    plan.interval_count > 0 &&
    Number.isInteger(plan.billing_cycles) &&
    plan.billing_cycles > 0 &&
    /^[A-Z]{3}$/.test(plan.currency)
  );
}

export async function getPublicSubscriptionPlans() {
  if (!isSupabaseConfigured()) return { status: "unconfigured", plans: [] };

  try {
    const client = await createClient({ allowCookieWrites: false });
    const { data, error } = await client
      .from("subscription_plans")
      .select(
        "id,name,slug,description,price_cents,currency,billing_interval,interval_count,billing_cycles",
      )
      .eq("is_active", true)
      .order("price_cents");

    if (error) {
      logPlanQueryFailure(error);
      return { status: "unavailable", plans: [] };
    }

    const rows = data || [];
    const plans = rows.filter(canCheckoutPlan);
    if (plans.length) return { status: "ready", plans };
    return {
      status: rows.length ? "misconfigured" : "empty",
      plans: [],
    };
  } catch (error) {
    unstable_rethrow(error);
    logPlanQueryFailure(error);
    return { status: "unavailable", plans: [] };
  }
}
