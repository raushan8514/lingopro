import { connection } from "next/server";
import SiteHeaderClient from "@/components/landing/site-header-client";
import { getAuthContext } from "@/lib/auth/server";

export default async function SiteHeader() {
  await connection();
  const auth = await getAuthContext();
  const account =
    auth.status === "authenticated"
      ? {
          email: auth.user.email,
          fullName: auth.fullName,
          role: auth.role,
        }
      : null;

  return <SiteHeaderClient account={account} authStatus={auth.status} />;
}
