import "server-only";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

function logBillingFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

async function read(operation, query) {
  const { data, error } = await query;
  if (error) {
    logBillingFailure(operation, error);
    throw new Error("Billing information could not be loaded.");
  }
  return data;
}

const transactionPageSize = 25;

function getPaymentQuery(client, studentId, page) {
  const start = (page - 1) * transactionPageSize;
  return client
    .from("payments")
    .select(
      "id,course_id,transaction_reference,purchase_description,amount_cents,currency,status,provider,provider_order_id,provider_payment_id,payment_method,failure_code,failure_description,receipt_number,paid_at,created_at",
      { count: "exact" },
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .range(start, start + transactionPageSize - 1);
}

export async function getStudentBillingData({ paymentPage: requestedPageValue = 1 } = {}) {
  const identity = await requireRole("student");
  const client = await createClient({ allowCookieWrites: false });
  const requestedPage = Math.min(Math.max(Number(requestedPageValue) || 1, 1), 10000);
  const [plans, subscriptions, payments] = await Promise.all([
    read(
      "load subscription plans",
      client
        .from("subscription_plans")
        .select(
          "id,name,slug,description,price_cents,currency,billing_interval,interval_count,billing_cycles,is_active",
        )
        .eq("is_active", true)
        .order("price_cents"),
    ),
    read(
      "load student subscriptions",
      client
        .from("subscriptions")
        .select(
          "id,plan_id,status,provider,provider_subscription_id,current_period_start,current_period_end,cancelled_at,cancel_at_period_end,created_at,subscription_plans(name,description,price_cents,currency,billing_interval,interval_count)",
        )
        .eq("student_id", identity.user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ),
    getPaymentQuery(client, identity.user.id, requestedPage),
  ]);

  if (payments.error) {
    logBillingFailure("load student payment history", payments.error);
    throw new Error("Billing information could not be loaded.");
  }

  const paymentTotal = payments.count || 0;
  const paymentPageCount = Math.max(1, Math.ceil(paymentTotal / transactionPageSize));
  const paymentPage = Math.min(requestedPage, paymentPageCount);
  let paymentRows = payments.data;
  if (paymentPage !== requestedPage) {
    const lastPage = await getPaymentQuery(client, identity.user.id, paymentPage);
    if (lastPage.error) {
      logBillingFailure("load student payment history", lastPage.error);
      throw new Error("Billing information could not be loaded.");
    }
    paymentRows = lastPage.data;
  }

  return {
    identity,
    plans: plans || [],
    subscriptions: subscriptions || [],
    payments: paymentRows || [],
    paymentTotal,
    paymentPage,
    paymentPageSize: transactionPageSize,
    paymentPageCount,
  };
}

export async function getStudentSubscriptionAndTransactions(paymentPage) {
  const data = await getStudentBillingData({ paymentPage });
  return {
    identity: data.identity,
    subscriptions: data.subscriptions,
    payments: data.payments,
    paymentTotal: data.paymentTotal,
    paymentPage: data.paymentPage,
    paymentPageSize: data.paymentPageSize,
    paymentPageCount: data.paymentPageCount,
  };
}
