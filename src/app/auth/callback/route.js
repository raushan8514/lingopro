import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeInternalPath } from "@/lib/auth/paths";

function redirectTo(path, requestUrl) {
  return NextResponse.redirect(new URL(path, requestUrl));
}

export async function GET(request) {
  const callbackUrl = new URL(request.url);
  const nextPath = getSafeInternalPath(
    callbackUrl.searchParams.get("next"),
    "/student",
  );

  if (
    callbackUrl.searchParams.has("error") ||
    callbackUrl.searchParams.has("error_code")
  ) {
    return redirectTo("/login?status=callback-error", request.url);
  }

  const code = callbackUrl.searchParams.get("code");
  if (!code || code.length > 4096) {
    return redirectTo("/login?status=callback-error", request.url);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Supabase authentication callback could not be verified.", {
        name: error.name,
        status: error.status,
        code: error.code,
      });
      return redirectTo("/login?status=callback-error", request.url);
    }

    return redirectTo(nextPath, request.url);
  } catch (error) {
    console.error("Supabase authentication callback failed.", {
      name: error?.name,
      status: error?.status,
      code: error?.code,
    });
    return redirectTo("/login?status=callback-error", request.url);
  }
}
