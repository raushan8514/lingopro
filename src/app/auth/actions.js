"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthCallbackUrl } from "@/lib/supabase/env";
import { getSafeRoleReturnPath } from "@/lib/auth/paths";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const unavailableMessage =
  "We couldn't reach the authentication service. Please try again shortly.";
const configurationMessage =
  "Authentication isn't configured yet. Add the Supabase project URL and anonymous key before using account features.";

function logAuthActionFailure(operation, error) {
  console.error(`LingoPro ${operation} failed.`, {
    name: error?.name,
    status: error?.status,
    code: error?.code,
  });
}

function getServiceFailureMessage(error) {
  if (
    error?.message?.includes("Supabase is not configured") ||
    error?.message?.includes("APP_BASE_URL must be configured")
  ) {
    return configurationMessage;
  }

  return unavailableMessage;
}

function validateEmail(email) {
  return typeof email === "string" && email.length <= 254 && emailPattern.test(email);
}

async function clearLocalSession(supabase) {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) logAuthActionFailure("session cleanup", error);
  } catch (error) {
    logAuthActionFailure("session cleanup", error);
  }
}

export async function registerAction(_previousState, formData) {
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const errors = {};

  if (fullName.length < 1 || fullName.length > 120) {
    errors.fullName = "Enter your name using 1–120 characters.";
  }
  if (!validateEmail(email)) errors.email = "Enter a valid email address.";
  if (password.length < 8 || password.length > 128) {
    errors.password = "Use a password between 8 and 128 characters.";
  }
  if (confirmPassword !== password) {
    errors.confirmPassword = "Your passwords do not match.";
  }
  if (formData.get("termsAccepted") !== "on") {
    errors.termsAccepted = "Please accept the terms to create an account.";
  }
  if (Object.keys(errors).length) return { errors };

  let result;
  try {
    const supabase = await createClient();
    result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: getAuthCallbackUrl("/student"),
      },
    });
  } catch (error) {
    logAuthActionFailure("registration", error);
    return { error: getServiceFailureMessage(error) };
  }

  if (result.error) {
    logAuthActionFailure("registration", result.error);
    return {
      error:
        "We couldn't create an account with those details. Try signing in or resetting your password if you may already have an account.",
    };
  }

  if (result.data.session) redirect("/student");
  redirect("/register?status=check-email");
}

export async function loginAction(_previousState, formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const errors = {};

  if (!validateEmail(email)) errors.email = "Enter a valid email address.";
  if (password.length === 0) errors.password = "Enter your password.";
  if (Object.keys(errors).length) return { errors };

  let supabase;
  let result;
  try {
    supabase = await createClient();
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch (error) {
    logAuthActionFailure("sign-in", error);
    return { error: getServiceFailureMessage(error) };
  }

  if (result.error || !result.data.user) {
    return { error: "The email or password is incorrect, or the email is not verified." };
  }

  let profileResult;
  try {
    profileResult = await supabase
      .from("profiles")
      .select("role")
      .eq("id", result.data.user.id)
      .maybeSingle();
  } catch (profileError) {
    logAuthActionFailure("profile verification after sign-in", profileError);
    await clearLocalSession(supabase);
    return {
      error:
        "We couldn't verify your account profile. Please contact support before trying again.",
    };
  }
  const { data: profile, error: profileError } = profileResult;

  if (profileError || !profile) {
    logAuthActionFailure(
      "profile verification after sign-in",
      profileError || new Error("The authenticated profile is missing."),
    );
    await clearLocalSession(supabase);
    return {
      error:
        "We couldn't verify your account profile. Please contact support before trying again.",
    };
  }

  redirect(
    getSafeRoleReturnPath(formData.get("next"), profile.role),
  );
}

export async function resendVerificationAction(_previousState, formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!validateEmail(email)) {
    return { errors: { email: "Enter a valid email address." } };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: getAuthCallbackUrl("/student") },
    });

    if (error) logAuthActionFailure("verification email resend", error);
    return {
      message:
        "If this address has an unverified account, a new verification email will arrive shortly.",
    };
  } catch (error) {
    logAuthActionFailure("verification email resend", error);
    return { error: getServiceFailureMessage(error) };
  }
}

export async function forgotPasswordAction(_previousState, formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!validateEmail(email)) {
    return { errors: { email: "Enter a valid email address." } };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrl("/reset-password"),
    });

    if (error) logAuthActionFailure("password recovery request", error);
    return {
      message:
        "If an account exists for that address, password-reset instructions will arrive shortly.",
    };
  } catch (error) {
    logAuthActionFailure("password recovery request", error);
    return { error: getServiceFailureMessage(error) };
  }
}

export async function resetPasswordAction(_previousState, formData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const errors = {};

  if (password.length < 8 || password.length > 128) {
    errors.password = "Use a password between 8 and 128 characters.";
  }
  if (confirmPassword !== password) {
    errors.confirmPassword = "Your passwords do not match.";
  }
  if (Object.keys(errors).length) return { errors };

  try {
    const supabase = await createClient();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
      return {
        error: "This password-reset link is invalid or has expired. Request a new one.",
      };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      logAuthActionFailure("password update", error);
      return { error: "We couldn't update your password. Request a new reset link and try again." };
    }
  } catch (error) {
    logAuthActionFailure("password update", error);
    return { error: getServiceFailureMessage(error) };
  }

  redirect("/student");
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      logAuthActionFailure("sign-out", error);
      return { error: "We couldn't end this session. Please try again." };
    }
  } catch (error) {
    logAuthActionFailure("sign-out", error);
    return { error: getServiceFailureMessage(error) };
  }

  redirect("/");
}
