import { connection } from "next/server";
import BrandMark from "@/components/shared/brand-mark";
import { getAuthContext } from "@/lib/auth/server";
import MarketplaceHeaderClient from "@/components/courses/marketplace-header-client";

export default async function MarketplaceHeader() {
  await connection();
  const auth = await getAuthContext();
  const account = auth.status === "authenticated"
    ? {
        email: auth.user.email,
        fullName: auth.fullName,
        role: auth.role,
      }
    : null;

  return (
    <MarketplaceHeaderClient
      brand={<BrandMark />}
      account={account}
      authStatus={auth.status}
    />
  );
}
