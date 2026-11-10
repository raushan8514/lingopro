export const roleHomePaths = {
  student: "/student",
  instructor: "/instructor",
  admin: "/admin",
};

export function getSafeInternalPath(value, fallback = "/") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://lingopro.invalid");
    if (
      url.origin !== "https://lingopro.invalid" ||
      url.pathname === "/auth/callback"
    ) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function getRoleHomePath(role) {
  return roleHomePaths[role] || "/login?status=profile-unavailable";
}

export function getSafeRoleReturnPath(value, role) {
  const fallback = roleHomePaths[role] || "/login?status=profile-unavailable";
  const path = getSafeInternalPath(value, fallback);
  const rolePrefix = roleHomePaths[role];

  if (!rolePrefix || (path !== rolePrefix && !path.startsWith(`${rolePrefix}/`))) {
    return fallback;
  }

  return path;
}
