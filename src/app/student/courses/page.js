import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { StudentCourseCard, StudentPageHeader } from "@/components/student/student-components";
import { getStudentCourseLibrary } from "@/lib/student/data";

export const metadata = {
  title: "My courses",
  robots: { index: false, follow: false },
};

function libraryUrl({ page, status, query }) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/student/courses?${search}` : "/student/courses";
}

export default async function StudentCoursesPage({ searchParams }) {
  const params = await searchParams;
  const data = await getStudentCourseLibrary({
    page: params.page,
    status: params.status,
    query: params.q,
  });
  const tabs = [
    ["all", "All courses"],
    ["ACTIVE", "In progress"],
    ["COMPLETED", "Completed"],
  ];

  return (
    <div className="student-page">
      <StudentPageHeader
        eyebrow="Your learning library"
        title="My courses"
        description="Every course here comes from your own enrollment history."
      />

      <section className="student-panel student-library-panel">
        <form className="student-library-filters" method="get">
          <label className="student-library-search">
            <Search size={17} aria-hidden="true" />
            <span className="student-sr-only">Search enrolled courses</span>
            <input
              type="search"
              name="q"
              defaultValue={data.query}
              placeholder="Search your courses"
              maxLength={80}
            />
          </label>
          <label className="student-sr-only" htmlFor="student-course-status">
            Filter course status
          </label>
          <select
            className="ui-input ui-select student-library-status"
            id="student-course-status"
            name="status"
            defaultValue={data.status}
          >
            {tabs.map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
          <button className="ui-button ui-button-secondary ui-button-md" type="submit">
            Apply filters
          </button>
        </form>

        <div className="student-library-tabs" role="navigation" aria-label="Course status filters">
          {tabs.map(([value, label]) => {
            const active = data.status === value;
            return (
              <Link
                href={libraryUrl({ page: 1, status: value, query: data.query })}
                key={value}
                aria-current={active ? "page" : undefined}
                className={active ? "is-active" : ""}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {data.courses.length ? (
          <div className="student-course-grid">
            {data.courses.map((course) => (
              <StudentCourseCard course={course} key={course.id} />
            ))}
          </div>
        ) : (
          <div className="student-library-empty">
            <BookOpen size={24} aria-hidden="true" />
            <h2>{data.total ? "No courses match these filters" : "No enrolled courses yet"}</h2>
            <p>
              {data.total
                ? "Try another search or choose a different course status."
                : "Published courses will appear here after you enroll."}
            </p>
            {!data.total && (
              <Link className="student-primary-link" href="/courses">
                Explore published courses
              </Link>
            )}
          </div>
        )}

        {data.totalPages > 1 && (
          <nav className="student-pagination" aria-label="Course pages">
            <Link
              href={libraryUrl({ page: Math.max(1, data.page - 1), status: data.status, query: data.query })}
              aria-disabled={data.page <= 1}
              tabIndex={data.page <= 1 ? -1 : undefined}
            >
              Previous
            </Link>
            <span>Page {data.page} of {data.totalPages}</span>
            <Link
              href={libraryUrl({ page: Math.min(data.totalPages, data.page + 1), status: data.status, query: data.query })}
              aria-disabled={data.page >= data.totalPages}
              tabIndex={data.page >= data.totalPages ? -1 : undefined}
            >
              Next
            </Link>
          </nav>
        )}
      </section>
    </div>
  );
}
