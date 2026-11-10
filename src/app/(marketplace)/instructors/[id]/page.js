import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, BookOpen, UserRound } from "lucide-react";
import { Alert, EmptyState } from "@/components/ui";
import CourseCard from "@/components/courses/course-card";
import InstructorAvatar from "@/components/courses/instructor-avatar";
import { ScrollStagger, ScrollStaggerItem } from "@/components/shared/animations";
import {
  getInstructorCourses,
  getPublicInstructorProfile,
} from "@/lib/courses/data";
import CourseLoading from "@/components/courses/course-loading";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function instructorPageHref(id, page) {
  return page > 1 ? `/instructors/${encodeURIComponent(id)}?page=${page}` : `/instructors/${encodeURIComponent(id)}`;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const result = uuidPattern.test(id)
    ? await getPublicInstructorProfile(id)
    : { status: "ready", instructor: null };
  const name = result.instructor?.full_name;

  return {
    title: name ? `${name} — language instructor` : "Language instructor",
    description: name
      ? `Explore published language courses by ${name} on LingoPro.`
      : "Discover published language courses from LingoPro instructors.",
    robots: result.status === "ready" && !name ? { index: false, follow: false } : undefined,
  };
}

export default function InstructorProfilePage({ params, searchParams }) {
  return (
    <Suspense fallback={<CourseLoading />}>
      <InstructorProfileContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function InstructorProfileContent({ params, searchParams }) {
  await connection();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const query = await searchParams;
  const pageNumber = Number.parseInt(Array.isArray(query?.page) ? query.page[0] : query?.page, 10);
  let page = Number.isInteger(pageNumber) && pageNumber > 0
    ? Math.min(pageNumber, 834)
    : 1;
  const [profileResult, courseResult] = await Promise.all([
    getPublicInstructorProfile(id),
    getInstructorCourses(id, page),
  ]);

  if (profileResult.status === "ready" && !profileResult.instructor) notFound();
  const lastPage = courseResult.status === "ready"
    ? Math.max(1, Math.ceil(courseResult.total / courseResult.pageSize))
    : page;
  if (courseResult.status === "ready" && page > lastPage) {
    page = lastPage;
  }
  const finalCourseResult =
    courseResult.status === "ready" && courseResult.page !== page
      ? await getInstructorCourses(id, page)
      : courseResult;
  const instructor = profileResult.instructor;
  const unavailable =
    profileResult.status !== "ready" || finalCourseResult.status !== "ready";

  return (
    <main id="main-content" className="market-page market-instructor-page">
      {unavailable ? (
        <div className="market-catalog-state">
          <Alert
            variant={profileResult.status === "unconfigured" ? "warning" : "error"}
            title={profileResult.status === "unconfigured" ? "Instructor profiles are not connected" : "Instructor information is temporarily unavailable"}
          >
            Connect the Supabase project and ensure the marketplace migration has been applied.
          </Alert>
        </div>
      ) : (
        <>
          <Link className="market-back-link" href="/courses">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to courses
          </Link>
          <section className="market-instructor-profile">
            <InstructorAvatar
              name={instructor.full_name}
              src={instructor.avatar_url || undefined}
              size="xl"
              className="market-instructor-avatar"
            />
            <div>
              <span className="market-eyebrow">
                <UserRound size={15} aria-hidden="true" />
                LingoPro instructor
              </span>
              <h1>{instructor.full_name}</h1>
              <p>Explore this instructor’s published language courses.</p>
            </div>
          </section>
          <section className="market-instructor-courses">
            <div className="market-catalog-heading">
              <div>
                <span className="market-section-kicker">
                  <BookOpen size={14} aria-hidden="true" />
                  Available to explore
                </span>
                <h2>Published courses</h2>
              </div>
              <p className="market-result-count">
                {finalCourseResult.total} {finalCourseResult.total === 1 ? "course" : "courses"}
              </p>
            </div>
            {finalCourseResult.courses.length ? (
              <ScrollStagger className="market-course-grid">
                {finalCourseResult.courses.map((course) => (
                  <ScrollStaggerItem className="market-course-grid-item" key={course.id}>
                    <CourseCard course={course} />
                  </ScrollStaggerItem>
                ))}
              </ScrollStagger>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No published courses yet"
                description="This instructor doesn’t currently have a published course to show."
              />
            )}
            {finalCourseResult.total > finalCourseResult.pageSize && (
              <nav className="market-pagination" aria-label="Instructor courses pages">
                <Link
                  href={instructorPageHref(id, page - 1)}
                  aria-disabled={page <= 1}
                  className={page <= 1 ? "is-disabled" : ""}
                  tabIndex={page <= 1 ? -1 : undefined}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Previous
                </Link>
                <span>Page <strong>{page}</strong> of <strong>{Math.ceil(finalCourseResult.total / finalCourseResult.pageSize)}</strong></span>
                <Link
                  href={instructorPageHref(id, page + 1)}
                  aria-disabled={page >= Math.ceil(finalCourseResult.total / finalCourseResult.pageSize)}
                  className={page >= Math.ceil(finalCourseResult.total / finalCourseResult.pageSize) ? "is-disabled" : ""}
                  tabIndex={page >= Math.ceil(finalCourseResult.total / finalCourseResult.pageSize) ? -1 : undefined}
                >
                  Next
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </nav>
            )}
          </section>
        </>
      )}
    </main>
  );
}
