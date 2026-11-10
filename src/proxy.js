import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/env";
import { getRoleHomePath } from "@/lib/auth/paths";
import { isAnonymousSessionError } from "@/lib/auth/session-errors";

const protectedRoles = [
  ["/student", "student"],
  ["/instructor", "instructor"],
  ["/admin", "admin"],
];

function getRequiredRole(pathname) {
  return protectedRoles.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )?.[1];
}

function redirectWithCookies(url, response) {
  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

function loginRedirect(request, response, status) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("status", status);
  return redirectWithCookies(loginUrl, response);
}

function requireLoginRedirect(request, response) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return redirectWithCookies(loginUrl, response);
}

function handleVerificationFailure(
  request,
  response,
  requiredRole,
  error,
  status = "service-unavailable",
) {
  console.error("Unable to verify a Supabase session in the request proxy.", {
    name: error?.name,
    status: error?.status,
    code: error?.code,
    message: typeof error?.message === "string" ? error.message.slice(0, 500) : undefined,
  });

  if (!requiredRole) return response;

  return loginRedirect(request, response, status);
}

export async function proxy(request) {
  const requiredRole = getRequiredRole(request.nextUrl.pathname);
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) {
    return requiredRole
      ? loginRedirect(request, response, "setup-required")
      : response;
  }

  let supabase;
  try {
    const { url, anonKey } = getSupabaseConfig();
    supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });
  } catch (error) {
    return handleVerificationFailure(
      request,
      response,
      requiredRole,
      error,
      "setup-required",
    );
  }

  let session;
  try {
    session = await supabase.auth.getUser();
  } catch (error) {
    if (isAnonymousSessionError(error)) {
      return requiredRole
        ? requireLoginRedirect(request, response)
        : response;
    }
    return handleVerificationFailure(request, response, requiredRole, error);
  }
  const { data, error } = session;

  if (error) {
    if (isAnonymousSessionError(error)) {
      return requiredRole
        ? requireLoginRedirect(request, response)
        : response;
    }

    return handleVerificationFailure(request, response, requiredRole, error);
  }

  if (!requiredRole) return response;

  if (!data.user) {
    return requireLoginRedirect(request, response);
  }

  let profileResult;
  try {
    profileResult = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
  } catch (profileError) {
    console.error("Unable to verify the Supabase profile role in the request proxy.", {
      name: profileError?.name,
      status: profileError?.status,
      code: profileError?.code,
    });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("status", "profile-unavailable");
    return redirectWithCookies(loginUrl, response);
  }
  const { data: profile, error: profileError } = profileResult;

  if (profileError || !profile) {
    console.error("Unable to verify the Supabase profile role in the request proxy.", {
      name: profileError?.name,
      status: profileError?.status,
      code: profileError?.code,
    });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("status", "profile-unavailable");
    return redirectWithCookies(loginUrl, response);
  }

  if (profile.role !== requiredRole) {
    return redirectWithCookies(
      new URL(getRoleHomePath(profile.role), request.url),
      response,
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
