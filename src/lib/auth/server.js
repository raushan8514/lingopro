import "server-only";
import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getRoleHomePath } from "@/lib/auth/paths";
import { isAnonymousSessionError } from "@/lib/auth/session-errors";

function logAuthReadFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    name: error?.name,
    status: error?.status,
    code: error?.code,
    message: typeof error?.message === "string" ? error.message.slice(0, 500) : undefined,
  });
}

export async function getAuthContext({ supabase: providedSupabase } = {}) {
  if (!isSupabaseConfigured()) {
    return { configured: false, user: null, role: null, status: "unconfigured" };
  }

  try {
    const supabase =
      providedSupabase || (await createClient({ allowCookieWrites: false }));
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      if (isAnonymousSessionError(error)) {
        return { configured: true, user: null, role: null, status: "anonymous" };
      }

      logAuthReadFailure("verify the current Supabase session", error);
      return { configured: true, user: null, role: null, status: "unavailable" };
    }

    if (!data.user) {
      return { configured: true, user: null, role: null, status: "anonymous" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      logAuthReadFailure(
        "load the authenticated user's profile",
        profileError || new Error("The authenticated profile is missing."),
      );
      return {
        configured: true,
        user: data.user,
        role: null,
        status: "profile-unavailable",
      };
    }

    return {
      configured: true,
      user: data.user,
      role: profile.role,
      fullName: profile.full_name,
      status: "authenticated",
    };
  } catch (error) {
    unstable_rethrow(error);
    if (isAnonymousSessionError(error)) {
      return { configured: true, user: null, role: null, status: "anonymous" };
    }
    logAuthReadFailure("reach Supabase authentication", error);
    return { configured: true, user: null, role: null, status: "unavailable" };
  }
}

export async function requireRole(allowedRole, options) {
  const auth = await getAuthContext(options);

  if (auth.status === "unconfigured") {
    redirect("/login?status=setup-required");
  }

  if (auth.status === "unavailable") {
    redirect("/login?status=service-unavailable");
  }

  if (!auth.user) {
    redirect("/login");
  }

  if (auth.role !== allowedRole) {
    redirect(getRoleHomePath(auth.role));
  }

  return auth;
}
