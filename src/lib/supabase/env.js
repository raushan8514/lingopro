export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before creating a client.",
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTP or HTTPS.");
  }

  return { url, anonKey };
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getAppBaseUrl() {
  const configuredUrl = process.env.APP_BASE_URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_BASE_URL must be configured in production.");
    }

    return "http://localhost:3000";
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("APP_BASE_URL must be a valid URL.");
  }

  const isLocalHost = ["localhost", "127.0.0.1"].includes(parsedUrl.hostname);
  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    (parsedUrl.protocol !== "https:" && !isLocalHost) ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      "APP_BASE_URL must be an HTTPS origin (HTTP is allowed for localhost).",
    );
  }

  return parsedUrl.origin;
}

export function getAuthCallbackUrl(nextPath) {
  const callbackUrl = new URL("/auth/callback", getAppBaseUrl());
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}
