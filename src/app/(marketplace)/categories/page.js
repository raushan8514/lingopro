import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Languages } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/indicators";
import { getPublicCourseCategories } from "@/lib/courses/data";
import { connection } from "next/server";

export const metadata = {
  title: "Language and course categories",
  description:
    "Browse LingoPro course categories backed by published learning content.",
  alternates: { canonical: "/categories" },
};

function CategoriesFallback() {
  return (
    <main id="main-content" className="market-page" aria-busy="true">
      <section className="market-hero">
        <div className="market-hero-copy">
          <Skeleton className="market-loading-eyebrow" />
          <Skeleton className="market-loading-title" />
          <Skeleton className="market-loading-copy" />
        </div>
      </section>
    </main>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<CategoriesFallback />}>
      <CategoriesContent />
    </Suspense>
  );
}

async function CategoriesContent() {
  await connection();
  const result = await getPublicCourseCategories();

  return (
    <main id="main-content" className="market-page">
      <section className="market-hero market-categories-hero">
        <div className="market-hero-copy">
          <span className="market-eyebrow">
            <Languages size={15} aria-hidden="true" />
            Learn by language or interest
          </span>
          <h1>Choose a direction.<br />Then find your words.</h1>
          <p>Every category here is connected to published LingoPro courses.</p>
        </div>
        <div className="market-hero-aside" aria-hidden="true">
          <BookOpen size={42} strokeWidth={1.4} />
          <span>Start with<br />what matters to you.</span>
        </div>
      </section>

      {result.status !== "ready" ? (
        <div className="market-catalog-state">
          <Alert
            variant={result.status === "unconfigured" ? "warning" : "error"}
            title={result.status === "unconfigured" ? "Course catalog not connected" : "Categories are temporarily unavailable"}
          >
            {result.status === "unconfigured"
              ? "Connect Supabase and apply the database migrations to browse course categories."
              : "We couldn't load current categories. Please try again shortly."}
          </Alert>
        </div>
      ) : result.categories.length ? (
        <section className="market-category-grid-section">
          <div className="market-category-grid-heading">
            <div>
              <span className="market-section-kicker">Real learning, ready to explore</span>
              <h2>Browse categories</h2>
            </div>
            <Link className="market-text-action" href="/courses">
              See all courses <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="market-category-grid">
            {result.categories.map((category) => (
              <Link
                href={`/categories/${encodeURIComponent(category.slug)}`}
                className="market-category-card"
                key={category.id}
              >
                <span className="market-category-icon" aria-hidden="true">
                  <Languages size={21} strokeWidth={1.6} />
                </span>
                <span className="market-category-card-name">{category.name}</span>
                {category.description && (
                  <span className="market-category-card-description">
                    {category.description}
                  </span>
                )}
                <span className="market-category-card-bottom">
                  {category.course_count} {category.course_count === 1 ? "course" : "courses"}
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <div className="market-catalog-state">
          <div className="market-no-data">
            <Languages size={28} aria-hidden="true" />
            <h2>No active course categories yet</h2>
            <p>
              Categories appear after an administrator creates them and
              associates them with a published course. Courses are listed only
              after review and approval.
            </p>
            <Link className="market-text-action" href="/courses">
              Explore courses <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
