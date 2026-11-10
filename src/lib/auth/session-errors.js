export function isAnonymousSessionError(error) {
  return error?.status === 401 || error?.name === "AuthSessionMissingError";
}
