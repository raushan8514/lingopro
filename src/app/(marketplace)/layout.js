import { Suspense } from "react";
import MarketplaceHeader from "@/components/courses/marketplace-header";
import BrandMark from "@/components/shared/brand-mark";
import SiteFooter from "@/components/landing/site-footer";
import "./marketplace.css";

function HeaderFallback() {
  return (
    <header className="market-header" aria-busy="true">
      <div className="market-header-inner"><BrandMark /></div>
    </header>
  );
}

export default function MarketplaceLayout({ children }) {
  return (
    <>
      <Suspense fallback={<HeaderFallback />}>
        <MarketplaceHeader />
      </Suspense>
      {children}
      <SiteFooter marketplace />
    </>
  );
}
