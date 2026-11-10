import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import CourseCatalog from "@/components/courses/course-catalog";
import CourseLoading from "@/components/courses/course-loading";
import { getPublicCourseCategories } from "@/lib/courses/data";
import { Alert } from "@/components/ui/feedback";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const result = await getPublicCourseCategories();
  const category = result.status === "ready"
    ? result.categories.find((item) => item.slug === slug)
    : null;

  return {
    title: category ? `${category.name} courses` : "Course category",
    description: category?.description || `Browse published ${category?.name || "language"} courses on LingoPro.`,
    alternates: { canonical: `/categories/${encodeURIComponent(slug)}` },
  };
}

export default function CategoryDetailPage({ params, searchParams }) {
  return (
    <Suspense fallback={<CourseLoading />}>
      <CategoryDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CategoryDetailContent({ params, searchParams }) {
  await connection();
  const { slug } = await params;
  const result = await getPublicCourseCategories();

  if (result.status === "ready") {
    const category = result.categories.find((item) => item.slug === slug);
    if (!category) notFound();

    return (
      <CourseCatalog
        searchParams={searchParams}
        pathname={`/categories/${encodeURIComponent(category.slug)}`}
        title={`${category.name}, at your own pace`}
        description={category.description || `Explore published courses in ${category.name}.`}
        lockedCategory={category}
      />
    );
  }

  return (
    <main id="main-content" className="market-page">
      <div className="market-catalog-state">
        <Alert
          variant={result.status === "unconfigured" ? "warning" : "error"}
          title={result.status === "unconfigured" ? "Course categories are not connected" : "Category details are temporarily unavailable"}
        >
          We couldn’t verify this category against current published course data.
          Please try again later.
        </Alert>
      </div>
    </main>
  );
}
