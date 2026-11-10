import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  SlidersHorizontal,
} from "lucide-react";
import { Alert, EmptyState } from "@/components/ui";
import CourseCard from "@/components/courses/course-card";
import CourseCatalogControls from "@/components/courses/course-catalog-controls";
import { ScrollStagger, ScrollStaggerItem } from "@/components/shared/animations";
import { getMarketplaceCatalog } from "@/lib/courses/data";
import {
  createCoursePageHref,
  parseCourseFilters,
} from "@/lib/courses/query";

function CatalogUnavailable({ configured }) {
  return (
    <div className="market-catalog-state">
      <Alert variant={configured ? "error" : "warning"} title={
        configured ? "Courses are temporarily unavailable" : "Connect the course catalog"
      }>
        {configured
          ? "We couldn't load current course information. Please try again shortly."
          : "Add the Supabase project URL and anonymous key, then apply the database migrations to browse published courses."}
      </Alert>
    </div>
  );
}

function Pagination({ page, pageSize, total, pathname, filters }) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;

  return (
    <nav className="market-pagination" aria-label="Course results pages">
      <Link
        href={createCoursePageHref(pathname, filters, page - 1)}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={page <= 1 ? "is-disabled" : ""}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Previous
      </Link>
      <span>
        Page <strong>{page}</strong> of <strong>{pageCount}</strong>
      </span>
      <Link
        href={createCoursePageHref(pathname, filters, page + 1)}
        aria-disabled={page >= pageCount}
        tabIndex={page >= pageCount ? -1 : undefined}
        className={page >= pageCount ? "is-disabled" : ""}
      >
        Next
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </nav>
  );
}

export default async function CourseCatalog({
  searchParams,
  pathname = "/courses",
  title = "Find your next way to say it",
  description = "Explore real courses from LingoPro instructors and choose a learning path that fits your goals.",
  lockedCategory = null,
}) {
  const params = await searchParams;
  let filters = parseCourseFilters(params);
  let catalogFilters = {
    ...filters,
    categoryId: lockedCategory?.id || filters.categoryId,
    category: lockedCategory ? "" : filters.category,
  };
  let result = await getMarketplaceCatalog(catalogFilters);
  const lastPage = result.status === "ready"
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : filters.page;

  if (result.status === "ready" && filters.page > lastPage) {
    filters = { ...filters, page: lastPage };
    catalogFilters = {
      ...filters,
      categoryId: lockedCategory?.id || filters.categoryId,
      category: lockedCategory ? "" : filters.category,
    };
    result = await getMarketplaceCatalog(catalogFilters);
  }
  const showLatest = !lockedCategory
    && filters.page === 1
    && filters.sort === "newest"
    && !filters.query
    && !filters.language
    && !filters.difficulty
    && filters.price === "all"
    && !filters.category;
  const recentlyPublished = showLatest ? result.courses?.slice(0, 3) || [] : [];
  const visibleCourses = recentlyPublished.length
    ? result.courses.slice(recentlyPublished.length)
    : result.courses;

  return (
    <main id="main-content" className="market-page">
      <section className="market-hero">
        <div className="market-hero-copy">
          <span className="market-eyebrow">
            <BookOpen size={15} aria-hidden="true" />
            A better way to begin
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="market-hero-aside" aria-hidden="true">
          <span className="market-hero-aside-mark">Aa</span>
          <span>Small lessons.<br />Wider worlds.</span>
        </div>
      </section>

      {result.status !== "ready" ? (
        <CatalogUnavailable configured={result.status !== "unconfigured"} />
      ) : (
        <>
          {!lockedCategory && result.categories.length > 0 && (
            <nav className="market-category-row" aria-label="Browse course categories">
              <span className="market-category-row-label">Explore by focus</span>
              <div className="market-category-chips">
                {result.categories.slice(0, 8).map((category) => (
                  <Link
                    className={`market-category-chip${filters.category === category.id ? " is-active" : ""}`}
                    href={`/categories/${encodeURIComponent(category.slug)}`}
                    key={category.id}
                  >
                    {category.name}
                    <span>{category.course_count}</span>
                  </Link>
                ))}
                <Link className="market-category-all" href="/categories">
                  All categories <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </nav>
          )}

          {recentlyPublished.length > 0 && (
            <section className="market-recent-section" aria-labelledby="market-recent-title">
              <div className="market-category-grid-heading">
                <div>
                  <span className="market-section-kicker">Ordered by publication date</span>
                  <h2 id="market-recent-title">Recently published</h2>
                </div>
              </div>
              <ScrollStagger className="market-course-grid market-recent-grid">
                {recentlyPublished.map((course) => (
                  <ScrollStaggerItem className="market-course-grid-item" key={course.id}>
                    <CourseCard course={course} />
                  </ScrollStaggerItem>
                ))}
              </ScrollStagger>
            </section>
          )}

          <section className="market-catalog-section" aria-labelledby="market-results-title">
            <div className="market-catalog-heading">
              <div>
                <span className="market-section-kicker">
                  <SlidersHorizontal size={14} aria-hidden="true" />
                  Your learning, your pace
                </span>
                <h2 id="market-results-title">
                  {lockedCategory ? `Explore ${lockedCategory.name}` : "Explore courses"}
                </h2>
              </div>
              <p className="market-result-count" aria-live="polite">
                {result.total} {result.total === 1 ? "course" : "courses"}
              </p>
            </div>
            <div className="market-catalog-layout">
              <CourseCatalogControls
                key={filters.query}
                filters={{
                  query: filters.query,
                  language: filters.language,
                  difficulty: filters.difficulty,
                  price: filters.price,
                  category: filters.category,
                  sort: filters.sort,
                }}
                languages={result.languages}
                categories={result.categories}
                lockedCategory={lockedCategory}
              />
              <div className="market-results-column">
                {visibleCourses.length ? (
                  <ScrollStagger className="market-course-grid">
                    {visibleCourses.map((course) => (
                      <ScrollStaggerItem className="market-course-grid-item" key={course.id}>
                        <CourseCard course={course} />
                      </ScrollStaggerItem>
                    ))}
                  </ScrollStagger>
                ) : (
                  <EmptyState
                    icon={AlertCircle}
                    title={
                      result.total === 0 && result.languages.length === 0
                        ? "No courses have been published yet"
                        : "No courses match those filters"
                    }
                    description={
                      result.total === 0 && result.languages.length === 0
                        ? "The marketplace only lists courses approved and published by an administrator. No published courses are currently available."
                        : "Try a different search or clear some filters to see available courses."
                    }
                    action={(
                      <Link className="market-text-action" href={lockedCategory ? `/categories/${encodeURIComponent(lockedCategory.slug)}` : "/courses"}>
                        {result.total === 0 && result.languages.length === 0
                          ? "Browse published courses"
                          : "Clear search and filters"} <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    )}
                    className="market-empty-results"
                  />
                )}
                <Pagination
                  page={filters.page}
                  pageSize={result.pageSize}
                  total={result.total}
                  pathname={pathname}
                  filters={catalogFilters}
                />
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
