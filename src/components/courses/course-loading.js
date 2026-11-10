import { Skeleton } from "@/components/ui";

export default function CourseLoading() {
  return (
    <main className="market-page" aria-busy="true">
      <section className="market-hero">
        <div className="market-hero-copy">
          <Skeleton className="market-loading-eyebrow" />
          <Skeleton className="market-loading-title" />
          <Skeleton className="market-loading-copy" />
        </div>
      </section>
      <section className="market-loading-results" aria-label="Loading courses">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="market-course-skeleton" key={index}>
            <Skeleton className="market-skeleton-image" />
            <Skeleton className="market-skeleton-line" />
            <Skeleton className="market-skeleton-line short" />
          </div>
        ))}
      </section>
    </main>
  );
}
