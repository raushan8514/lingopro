import { Suspense } from "react";
import SiteHeader from "@/components/landing/site-header";
import BrandMark from "@/components/shared/brand-mark";
import Hero from "@/components/landing/hero";
import LanguageDiscovery from "@/components/landing/language-discovery";
import FeatureGrid from "@/components/landing/feature-grid";
import LearningJourney from "@/components/landing/learning-journey";
import CoursePreview from "@/components/landing/course-preview";
import TutorPreview from "@/components/landing/tutor-preview";
import ProductPreviews from "@/components/landing/product-previews";
import Pricing from "@/components/landing/pricing";
import Testimonials from "@/components/landing/testimonials";
import FAQ from "@/components/landing/faq";
import FinalCTA from "@/components/landing/final-cta";
import SiteFooter from "@/components/landing/site-footer";
import "./landing.css";

export default function Home() {
  return (
    <>
      <Suspense
        fallback={(
          <header className="landing-header" aria-busy="true">
            <div className="landing-header-inner"><BrandMark /></div>
          </header>
        )}
      >
        <SiteHeader />
      </Suspense>
      <main id="main-content">
        <Hero />
        <LanguageDiscovery />
        <FeatureGrid />
        <LearningJourney />
        <CoursePreview />
        <TutorPreview />
        <ProductPreviews />
        <Pricing />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
    </>
  );
}
