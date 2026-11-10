"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createRazorpayClient, getRazorpayConfiguration } from "@/lib/payments/razorpay";
import {
  verifyOrderPaymentSignature,
  verifySubscriptionPaymentSignature,
} from "@/lib/payments/verification";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_ID_PATTERN = /^order_[A-Za-z0-9]+$/;
const PAYMENT_ID_PATTERN = /^pay_[A-Za-z0-9]+$/;
const PLAN_ID_PATTERN = /^plan_[A-Za-z0-9]+$/;
const SUBSCRIPTION_ID_PATTERN = /^sub_[A-Za-z0-9]+$/;

// function logPaymentFailure(operation, error) {
//   console.error(`Unable to ${operation}.`, {
//     code: error?.code,
//     status: error?.status,
//     name: error?.name,
//   });
// }


function logPaymentFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    name: error?.name,
    status: error?.status,
    code: error?.error?.code || error?.code,
    description: error?.error?.description || error?.message,
    reason: error?.error?.reason,
    field: error?.error?.field,
  });
}

function databaseError(error, operation) {
  if (!error) return;
  logPaymentFailure(operation, error);
  throw new Error(`Payment processing could not ${operation}.`);
}

function getSingleRow(data, operation) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error(`Payment processing could not ${operation}.`);
  return row;
}

export async function createCourseCheckoutAction(courseId, requestId) {
  const identity = await requireRole("student");
  if (!UUID_PATTERN.test(String(courseId || "")) || !UUID_PATTERN.test(String(requestId || ""))) {
    return { error: "This checkout request is invalid. Refresh the course page and try again." };
  }

  try {
    const config = getRazorpayConfiguration();
    const client = await createClient();
    const { data, error } = await client.rpc("create_pending_course_payment", {
      target_course_id: courseId,
      request_idempotency_key: requestId,
    });
    databaseError(error, "prepare the course checkout");
    const payment = getSingleRow(data, "prepare the course checkout");
    const razorpay = createRazorpayClient();
    const service = createServiceClient();

    let order;
    if (payment.provider_order_id) {
      order = await razorpay.orders.fetch(payment.provider_order_id);
      if (
        order.amount !== payment.amount_cents ||
        order.currency !== payment.currency ||
        order.receipt !== payment.transaction_reference
      ) {
        throw new Error("The existing provider order does not match the stored purchase.");
      }
      if (order.status === "paid") {
        const payments = await razorpay.orders.fetchPayments(order.id);
        const capturedPayment = payments.items?.find((item) =>
          item.status === "captured" &&
          item.order_id === order.id &&
          item.amount === payment.amount_cents &&
          item.currency === payment.currency,
        );
        if (capturedPayment) {
          const { error: completionError } = await service.rpc(
            "complete_razorpay_course_payment",
            {
              target_payment_id: payment.payment_id,
              target_order_id: order.id,
              target_provider_payment_id: capturedPayment.id,
              target_amount_cents: capturedPayment.amount,
              target_currency: capturedPayment.currency,
              target_payment_method: capturedPayment.method || null,
            },
          );
          databaseError(completionError, "verify and activate the course purchase");
          revalidatePath("/student/courses");
          revalidatePath("/student");
          return {
            verified: true,
            message: "Razorpay confirmed the captured payment. Your course access is active.",
          };
        }
        return {
          error: "Razorpay reports a paid order, but no matching captured payment was found. Access remains locked.",
        };
      }
      if (payment.payment_status === "AUTHORIZED") {
        return {
          error: "This payment is still being confirmed. Check your transactions before retrying.",
        };
      }
    } else {
      order = await razorpay.orders.create({
        amount: payment.amount_cents,
        currency: payment.currency,
        receipt: payment.transaction_reference,
        notes: {
          lingopro_payment_id: payment.payment_id,
          lingopro_transaction_reference: payment.transaction_reference,
        },
      });

      const { error: attachError } = await service.rpc("attach_razorpay_order", {
        target_payment_id: payment.payment_id,
        target_order_id: order.id,
      });
      if (attachError) {
        logPaymentFailure("attach the Razorpay order to the purchase", attachError);
        throw new Error("The provider order could not be linked to the purchase.");
      }
    }

    if (
      !ORDER_ID_PATTERN.test(order.id) ||
      order.amount !== payment.amount_cents ||
      order.currency !== payment.currency
    ) {
      throw new Error("The provider returned an order that does not match the purchase.");
    }

    return {
      checkout: {
        paymentId: payment.payment_id,
        transactionReference: payment.transaction_reference,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        title: payment.purchase_description,
        keyId: config.publicKeyId,
        mode: config.mode,
      },
    };
  } catch (error) {
    logPaymentFailure("create the course checkout", error);
    return {
      error: "Checkout could not be started. No course access was granted; please try again.",
    };
  }
}

export async function verifyCourseCheckoutAction({
  paymentId,
  orderId,
  providerPaymentId,
  signature,
}) {
  const identity = await requireRole("student");
  if (
    !UUID_PATTERN.test(String(paymentId || "")) ||
    !ORDER_ID_PATTERN.test(String(orderId || "")) ||
    !PAYMENT_ID_PATTERN.test(String(providerPaymentId || "")) ||
    typeof signature !== "string" ||
    signature.length > 256
  ) {
    return { error: "The payment response could not be verified." };
  }

  try {
    const config = getRazorpayConfiguration();
    const service = createServiceClient();
    const { data: payment, error } = await service
      .from("payments")
      .select(
        "id,student_id,course_id,provider,provider_order_id,amount_cents,currency,status",
      )
      .eq("id", paymentId)
      .eq("student_id", identity.user.id)
      .maybeSingle();
    databaseError(error, "load the pending course purchase");

    if (
      !payment ||
      payment.provider !== "RAZORPAY" ||
      !payment.course_id ||
      payment.provider_order_id !== orderId
    ) {
      return { error: "This payment does not match your pending course purchase." };
    }

    if (
      !verifyOrderPaymentSignature(orderId, providerPaymentId, signature, config.keySecret)
    ) {
      return { error: "Razorpay's payment signature could not be verified." };
    }

    const razorpay = createRazorpayClient();
    const providerPayment = await razorpay.payments.fetch(providerPaymentId);
    if (
      providerPayment.id !== providerPaymentId ||
      providerPayment.order_id !== orderId ||
      providerPayment.amount !== payment.amount_cents ||
      providerPayment.currency !== payment.currency
    ) {
      return { error: "The provider payment does not match the expected amount and currency." };
    }
    if (providerPayment.status !== "captured") {
      return {
        pending: true,
        message: "Payment is not captured yet. Course access remains locked until confirmation.",
      };
    }

    const { data: enrollmentId, error: completionError } = await service.rpc(
      "complete_razorpay_course_payment",
      {
        target_payment_id: payment.id,
        target_order_id: orderId,
        target_provider_payment_id: providerPayment.id,
        target_amount_cents: providerPayment.amount,
        target_currency: providerPayment.currency,
        target_payment_method: providerPayment.method || null,
      },
    );
    databaseError(completionError, "verify and activate the course purchase");
    if (!enrollmentId) throw new Error("Verified payment did not return an enrollment.");

    revalidatePath("/student/courses");
    revalidatePath("/student");
    revalidatePath("/courses");
    return { success: true, message: "Payment verified. Your course access is active." };
  } catch (error) {
    logPaymentFailure("verify the course checkout", error);
    return {
      error: "We could not confirm the payment yet. Check Transactions before retrying checkout.",
    };
  }
}

export async function reconcileCoursePaymentAction(_previousState, formData) {
  const identity = await requireRole("student");
  const paymentId = String(formData.get("paymentId") || "");
  if (!UUID_PATTERN.test(paymentId)) {
    return { error: "Choose a valid course payment." };
  }

  try {
    const service = createServiceClient();
    const { data: payment, error } = await service
      .from("payments")
      .select("id,student_id,course_id,provider_order_id,transaction_reference,amount_cents,currency,status")
      .eq("id", paymentId)
      .eq("student_id", identity.user.id)
      .maybeSingle();
    databaseError(error, "load the course payment");

    if (!payment || payment.course_id === null || !payment.provider_order_id) {
      return { error: "This payment cannot be reconciled from the available provider record." };
    }
    if (payment.status === "SUCCEEDED") {
      return { success: true, message: "This course payment is already verified." };
    }
    if (!["PENDING", "AUTHORIZED"].includes(payment.status)) {
      return { error: "Only pending course payments can be checked again." };
    }

    const razorpay = createRazorpayClient();
    const order = await razorpay.orders.fetch(payment.provider_order_id);
    if (
      order.id !== payment.provider_order_id ||
      order.amount !== payment.amount_cents ||
      order.currency !== payment.currency ||
      order.receipt !== payment.transaction_reference
    ) {
      return { error: "Razorpay's order does not match the stored purchase. Course access remains locked." };
    }
    if (order.status !== "paid") {
      return {
        pending: true,
        message: "Razorpay has not confirmed a captured payment yet. Course access remains locked.",
      };
    }

    const providerPayments = await razorpay.orders.fetchPayments(order.id);
    const capturedPayment = providerPayments.items?.find((item) =>
      item.status === "captured" &&
      item.order_id === order.id &&
      item.amount === payment.amount_cents &&
      item.currency === payment.currency,
    );
    if (!capturedPayment) {
      return {
        pending: true,
        message: "The order is paid, but no matching captured payment was found. Course access remains locked.",
      };
    }

    const { error: completionError } = await service.rpc(
      "complete_razorpay_course_payment",
      {
        target_payment_id: payment.id,
        target_order_id: order.id,
        target_provider_payment_id: capturedPayment.id,
        target_amount_cents: capturedPayment.amount,
        target_currency: capturedPayment.currency,
        target_payment_method: capturedPayment.method || null,
      },
    );
    databaseError(completionError, "reconcile the verified course payment");
    revalidatePath("/student/transactions");
    revalidatePath("/student/courses");
    revalidatePath("/student");
    revalidatePath("/courses");
    return {
      success: true,
      message: "Razorpay confirmed the captured payment. Your course access is active.",
    };
  } catch (error) {
    logPaymentFailure("reconcile the course payment", error);
    return {
      error: "Payment status could not be refreshed. Course access remains unchanged; try again later.",
    };
  }
}

async function getOrCreateRazorpayPlan(razorpay, service, plan, mode) {
  if (
    plan.provider_amount_cents !== plan.amount_cents ||
    plan.provider_currency !== plan.currency ||
    plan.provider_billing_cycles !== plan.billing_cycles
  ) {
    throw new Error("The subscription terms changed after this checkout was prepared.");
  }

  const providerPeriod = {
    MONTH: "monthly",
    YEAR: "yearly",
  }[plan.billing_interval];
  if (!providerPeriod || !Number.isInteger(plan.billing_cycles) || plan.billing_cycles < 1) {
    throw new Error("This plan has no supported billing cycle configuration.");
  }

  let providerPlanId =
    plan.razorpay_plan_mode === mode ? plan.razorpay_plan_id : null;
  if (!providerPlanId) {
    const providerPlan = await razorpay.plans.create({
      period: providerPeriod,
      interval: plan.interval_count,
      item: {
        name: plan.plan_name,
        amount: plan.amount_cents,
        currency: plan.currency,
        description: plan.plan_description || plan.plan_name,
      },
      notes: { lingopro_plan_id: plan.plan_id },
    });
    const { data, error } = await service.rpc("attach_razorpay_plan", {
      target_plan_id: plan.plan_id,
      target_razorpay_plan_id: providerPlan.id,
      target_razorpay_plan_mode: mode,
    });
    databaseError(error, "save the provider plan reference");
    providerPlanId = data;
  }

  if (!PLAN_ID_PATTERN.test(providerPlanId)) {
    throw new Error("The configured provider plan reference is invalid.");
  }
  const storedProviderPlan = await razorpay.plans.fetch(providerPlanId);
  if (
    storedProviderPlan.period !== providerPeriod ||
    storedProviderPlan.interval !== plan.interval_count ||
    storedProviderPlan.item?.amount !== plan.amount_cents ||
    storedProviderPlan.item?.currency !== plan.currency
  ) {
    throw new Error("The Razorpay plan differs from the current trusted plan configuration.");
  }
  return providerPlanId;
}

export async function createSubscriptionCheckoutAction(planId) {
  const identity = await requireRole("student");
  if (!UUID_PATTERN.test(String(planId || ""))) {
    return { error: "Choose a valid subscription plan." };
  }

  try {
    const config = getRazorpayConfiguration();
    const client = await createClient();
    const { data, error } = await client.rpc("create_pending_razorpay_subscription", {
      target_plan_id: planId,
    });
    databaseError(error, "prepare the subscription");
    const subscription = getSingleRow(data, "prepare the subscription");
    if (subscription.creation_in_progress) {
      return {
        error: "This subscription checkout is already being prepared. Wait a moment and retry.",
      };
    }
    const service = createServiceClient();
    const razorpay = createRazorpayClient();
    const providerPlanId = await getOrCreateRazorpayPlan(
      razorpay,
      service,
      subscription,
      config.mode,
    );

    let providerSubscription;
    if (subscription.existing_provider_subscription_id) {
      providerSubscription = await razorpay.subscriptions.fetch(
        subscription.existing_provider_subscription_id,
      );
      if (providerSubscription.plan_id !== providerPlanId) {
        throw new Error("The existing provider subscription uses a different plan.");
      }
      if (["cancelled", "completed", "expired"].includes(providerSubscription.status)) {
        const { error: expireError } = await service.rpc(
          "expire_pending_razorpay_subscription",
          {
            target_subscription_id: subscription.subscription_id,
            provider_status: providerSubscription.status,
          },
        );
        databaseError(expireError, "close the expired subscription checkout");
        return {
          error: "That checkout has expired. Select the plan again to start a new one.",
        };
      }
      if (!["created", "authenticated", "pending"].includes(providerSubscription.status)) {
        revalidatePath("/student/subscription");
        return {
          error: "Razorpay is still processing this subscription. Check its status before retrying.",
        };
      }
    } else {
      providerSubscription = await razorpay.subscriptions.create({
        plan_id: providerPlanId,
        total_count: subscription.billing_cycles,
        quantity: 1,
        customer_notify: true,
        notes: { lingopro_subscription_id: subscription.subscription_id },
      });
      const { error: attachError } = await service.rpc("attach_razorpay_subscription", {
        target_subscription_id: subscription.subscription_id,
        target_razorpay_subscription_id: providerSubscription.id,
      });
      if (attachError) {
        logPaymentFailure("attach the provider subscription", attachError);
        throw new Error("The provider subscription could not be linked to the account.");
      }
    }

    if (!SUBSCRIPTION_ID_PATTERN.test(providerSubscription.id)) {
      throw new Error("The provider returned an invalid subscription reference.");
    }

    return {
      checkout: {
        subscriptionId: subscription.subscription_id,
        providerSubscriptionId: providerSubscription.id,
        planName: subscription.provider_plan_name,
        keyId: config.publicKeyId,
        mode: config.mode,
      },
    };
  } catch (error) {
    logPaymentFailure("create the subscription checkout", error);
    return {
      error: "Subscription checkout could not be started. No subscription was activated.",
    };
  }
}

export async function verifySubscriptionCheckoutAction({
  subscriptionId,
  providerSubscriptionId,
  providerPaymentId,
  signature,
}) {
  const identity = await requireRole("student");
  if (
    !UUID_PATTERN.test(String(subscriptionId || "")) ||
    !/^sub_[A-Za-z0-9]+$/.test(String(providerSubscriptionId || "")) ||
    !/^pay_[A-Za-z0-9]+$/.test(String(providerPaymentId || "")) ||
    typeof signature !== "string" ||
    signature.length > 256
  ) {
    return { error: "The subscription payment response could not be verified." };
  }

  try {
    const config = getRazorpayConfiguration();
    const service = createServiceClient();
    const { data: subscription, error } = await service
      .from("subscriptions")
      .select("id,student_id,provider,provider_subscription_id,status")
      .eq("id", subscriptionId)
      .eq("student_id", identity.user.id)
      .maybeSingle();
    databaseError(error, "load the pending subscription");
    if (
      !subscription ||
      subscription.provider !== "RAZORPAY" ||
      subscription.provider_subscription_id !== providerSubscriptionId
    ) {
      return { error: "This payment does not match your pending subscription." };
    }
    if (
      !verifySubscriptionPaymentSignature(
        providerSubscriptionId,
        providerPaymentId,
        signature,
        config.keySecret,
      )
    ) {
      return { error: "Razorpay's subscription signature could not be verified." };
    }

    const razorpay = createRazorpayClient();
    const [payment, providerSubscription] = await Promise.all([
      razorpay.payments.fetch(providerPaymentId),
      razorpay.subscriptions.fetch(providerSubscriptionId),
    ]);
    if (
      payment.id !== providerPaymentId ||
      payment.subscription_id !== providerSubscriptionId ||
      providerSubscription.id !== providerSubscriptionId
    ) {
      return { error: "The provider response does not match this subscription." };
    }
    if (payment.status !== "captured") {
      return {
        pending: true,
        message: "The authorization is awaiting confirmation. The subscription status is not active yet.",
      };
    }

    const { error: paymentError } = await service.rpc(
      "complete_razorpay_subscription_payment",
      {
        target_subscription_id: subscription.id,
        target_provider_subscription_id: providerSubscriptionId,
        target_provider_payment_id: payment.id,
        target_amount_cents: payment.amount,
        target_currency: payment.currency,
        target_payment_method: payment.method || null,
      },
    );
    databaseError(paymentError, "record the verified subscription payment");
    revalidatePath("/student/subscription");
    revalidatePath("/student/transactions");
    return {
      pending: true,
      message: "Authorization payment verified. Subscription activation is confirmed by Razorpay's webhook.",
    };
  } catch (error) {
    logPaymentFailure("verify the subscription checkout", error);
    return {
      error: "We could not confirm the subscription payment yet. Check your subscription status.",
    };
  }
}

export async function cancelSubscriptionAction(formData) {
  const identity = await requireRole("student");
  const subscriptionId = String(formData.get("subscriptionId") || "");
  if (!UUID_PATTERN.test(String(subscriptionId || ""))) {
    return { error: "Choose a valid subscription." };
  }

  try {
    const service = createServiceClient();
    const { data: subscription, error } = await service
      .from("subscriptions")
      .select("id,student_id,provider,provider_subscription_id,status,cancel_at_period_end")
      .eq("id", subscriptionId)
      .eq("student_id", identity.user.id)
      .maybeSingle();
    databaseError(error, "load the current subscription");
    if (
      !subscription ||
      subscription.provider !== "RAZORPAY" ||
      !subscription.provider_subscription_id
    ) {
      return { error: "This subscription cannot be cancelled online." };
    }
    if (!["ACTIVE", "PAST_DUE", "HALTED", "PAUSED"].includes(subscription.status)) {
      return { error: "Only an active or past-due subscription can be cancelled." };
    }
    if (subscription.cancel_at_period_end || subscription.status === "CANCELLED") {
      return { success: "Cancellation is already scheduled or complete." };
    }

    const razorpay = createRazorpayClient();
    const providerSubscription = await razorpay.subscriptions.cancel(
      subscription.provider_subscription_id,
      true,
    );
    if (
      providerSubscription.id !== subscription.provider_subscription_id ||
      !["active", "cancelled", "completed", "expired"].includes(providerSubscription.status)
    ) {
      throw new Error("Razorpay did not confirm the requested cancellation.");
    }

    const { error: updateError } = await service.rpc(
      "confirm_razorpay_subscription_cancellation",
      {
        target_subscription_id: subscription.id,
        provider_status: providerSubscription.status,
      },
    );
    databaseError(updateError, "record the confirmed cancellation");
    revalidatePath("/student/subscription");
    return {
      success: providerSubscription.status === "active"
        ? "Cancellation is scheduled for the end of the current billing period."
        : "Razorpay confirmed the subscription cancellation.",
    };
  } catch (error) {
    logPaymentFailure("cancel the subscription", error);
    return { error: "Razorpay did not confirm cancellation. Your subscription status was not changed." };
  }
}
