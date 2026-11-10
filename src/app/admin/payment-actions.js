"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

function logPlanFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

export async function createSubscriptionPlanAction(_previousState, formData) {
  await requireRole("admin");
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const description = String(formData.get("description") || "").trim();
  const priceCents = Number(formData.get("price_cents"));
  const currency = String(formData.get("currency") || "").trim().toUpperCase();
  const billingInterval = String(formData.get("billing_interval") || "");
  const intervalCount = Number(formData.get("interval_count"));
  const billingCycles = Number(formData.get("billing_cycles"));

  if (name.length < 1 || name.length > 120) {
    return { error: "Plan name must be between 1 and 120 characters." };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    return { error: "Use a lowercase, URL-safe slug for the plan." };
  }
  if (description.length > 2000) {
    return { error: "Plan description must be no longer than 2,000 characters." };
  }
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0) {
    return { error: "Enter the plan price as a positive integer in the currency's minor units." };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: "Enter a valid three-letter currency code." };
  }
  if (!["MONTH", "YEAR"].includes(billingInterval)) {
    return { error: "Only monthly and annual billing intervals are supported." };
  }
  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    return { error: "Billing interval count must be a positive whole number." };
  }
  if (!Number.isInteger(billingCycles) || billingCycles < 1) {
    return { error: "Set a positive number of billing cycles; renewal terms are not assumed." };
  }

  const client = await createClient();
  const { error } = await client.from("subscription_plans").insert({
    name,
    slug,
    description: description || null,
    price_cents: priceCents,
    currency,
    billing_interval: billingInterval,
    interval_count: intervalCount,
    billing_cycles: billingCycles,
    is_active: false,
  });

  if (error) {
    logPlanFailure("create the subscription plan", error);
    if (error.code === "23505") return { error: "A plan already uses that slug." };
    return { error: "The subscription plan could not be saved." };
  }

  revalidatePath("/admin/subscriptions");
  revalidatePath("/student/subscription");
  revalidatePath("/");
  return { success: "Plan saved as inactive. Review its terms, then activate it when it is ready for checkout." };
}

export async function updateSubscriptionPlanMetadataAction(_previousState, formData) {
  await requireRole("admin");
  const planId = String(formData.get("planId") || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId)) {
    return { error: "Choose a valid subscription plan." };
  }

  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const description = String(formData.get("description") || "").trim();
  if (name.length < 1 || name.length > 120) {
    return { error: "Plan name must be between 1 and 120 characters." };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    return { error: "Use a lowercase, URL-safe slug for the plan." };
  }
  if (description.length > 2000) {
    return { error: "Plan description must be no longer than 2,000 characters." };
  }

  const client = await createClient();
  const { data, error } = await client
    .from("subscription_plans")
    .update({ name, slug, description: description || null })
    .eq("id", planId)
    .select("id")
    .maybeSingle();
  if (error) {
    logPlanFailure("update subscription plan metadata", error);
    if (error.code === "23505") return { error: "A plan already uses that slug." };
    return { error: "Plan details could not be saved." };
  }
  if (!data) {
    return { error: "The subscription plan could not be found." };
  }

  revalidatePath("/admin/subscriptions");
  revalidatePath("/student/subscription");
  revalidatePath("/");
  return { success: "Plan display details saved. Existing billing terms and transaction history are unchanged." };
}

export async function setSubscriptionPlanActiveAction(_previousState, formData) {
  await requireRole("admin");
  const planId = String(formData.get("planId") || "");
  const targetStatus = String(formData.get("targetStatus") || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId)) {
    return { error: "Choose a valid subscription plan." };
  }
  if (!["active", "inactive"].includes(targetStatus)) {
    return { error: "Choose a valid plan status." };
  }

  const client = await createClient();
  if (targetStatus === "active") {
    const { data: plan, error: planError } = await client
      .from("subscription_plans")
      .select("price_cents,billing_interval,interval_count,billing_cycles,currency")
      .eq("id", planId)
      .maybeSingle();
    if (planError) {
      logPlanFailure("validate the subscription plan", planError);
      return { error: "The plan could not be validated for activation." };
    }
    if (!plan) return { error: "The subscription plan could not be found." };
    if (
      !Number.isSafeInteger(plan.price_cents) ||
      plan.price_cents <= 0 ||
      !/^[A-Z]{3}$/.test(plan.currency) ||
      !["MONTH", "YEAR"].includes(plan.billing_interval) ||
      !Number.isInteger(plan.interval_count) ||
      plan.interval_count < 1 ||
      !Number.isInteger(plan.billing_cycles) ||
      plan.billing_cycles < 1
    ) {
      return {
        error: "Only plans with a positive price, supported interval, currency, and finite cycle count can be activated.",
      };
    }
  }

  const { data, error } = await client
    .from("subscription_plans")
    .update({ is_active: targetStatus === "active" })
    .eq("id", planId)
    .select("id")
    .maybeSingle();
  if (error) {
    logPlanFailure("change subscription plan status", error);
    return { error: "The plan status could not be changed." };
  }
  if (!data) return { error: "The subscription plan could not be found." };

  revalidatePath("/admin/subscriptions");
  revalidatePath("/student/subscription");
  revalidatePath("/");
  return {
    success: targetStatus === "active"
      ? "Plan activated and made available for checkout."
      : "Plan deactivated. Existing subscription records and transactions are unchanged.",
  };
}
