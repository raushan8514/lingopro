import "server-only";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

function logPaymentReadFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

export async function getAdminPayments({ search = "", status = "", page = 1 } = {}) {
  await requireRole("admin");
  const client = await createClient({ allowCookieWrites: false });
  const safePage = Math.min(Math.max(Number(page) || 1, 1), 10000);
  const { data, error } = await client.rpc("admin_list_payment_records", {
    search_term: String(search).trim().slice(0, 100) || null,
    status_filter: status || null,
    page_number: safePage,
    page_size: 25,
  });

  if (error) {
    logPaymentReadFailure("load administrator payment records", error);
    throw new Error("Payment records are unavailable.");
  }

  const records = data || [];
  return {
    records,
    page: safePage,
    total: Number(records[0]?.total_count || 0),
    pageSize: 25,
    search: String(search).trim().slice(0, 100),
    status,
  };
}

export async function getAdminSubscriptions() {
  await requireRole("admin");
  const client = await createClient({ allowCookieWrites: false });
  const { data, error } = await client
    .from("subscriptions")
    .select(
      "id,student_id,plan_id,status,provider,provider_subscription_id,current_period_start,current_period_end,cancelled_at,cancel_at_period_end,created_at,subscription_plans(name,billing_interval,interval_count,currency,price_cents)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logPaymentReadFailure("load administrator subscription records", error);
    throw new Error("Subscription records are unavailable.");
  }
  return data || [];
}
