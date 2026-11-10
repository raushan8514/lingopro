import Link from "next/link";
import { Search } from "lucide-react";
import {
  InstructorEmptyState,
  InstructorPageHeader,
  InstructorPanel,
  InstructorStatus,
} from "@/components/instructor/instructor-components";
import { getInstructorCourses } from "@/lib/instructor/data";

export const metadata = {
  title: "My courses",
  robots: { index: false, follow: false },
};

const statuses = [
  ["ALL", "All statuses"],
  ["DRAFT", "Draft"],
  ["PENDING_REVIEW", "In review"],
  ["PUBLISHED", "Published"],
  ["ARCHIVED", "Archived"],
];

export default async function InstructorCoursesPage({ searchParams }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "ALL";
  const { courses } = await getInstructorCourses({
    query,
    status,
  });

  return (
    <div className="student-page instructor-page">
      <InstructorPageHeader
        eyebrow="Course portfolio"
        title="My courses"
        description="Create drafts, build curriculum, and track review or publication status."
        actionHref="/instructor/courses/new"
        actionLabel="Create course"
      />
      <InstructorPanel>
        <form className="instructor-filter-form" method="get">
          <label className="instructor-search-field">
            <Search size={16} aria-hidden="true" />
            <span className="instructor-sr-only">Search courses</span>
            <input type="search" name="q" defaultValue={query} maxLength={80} placeholder="Search title, language, or slug" />
          </label>
          <label className="instructor-sr-only" htmlFor="instructor-course-status">Filter by status</label>
          <select className="ui-input ui-select instructor-status-filter" name="status" id="instructor-course-status" defaultValue={status}>
            {statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <button className="ui-button ui-button-secondary ui-button-md" type="submit">Apply filters</button>
        </form>

        {courses.length ? (
          <div className="instructor-course-list">
            {courses.map((course) => (
              <article className="instructor-course-row instructor-course-row-card" key={course.id}>
                <div className="instructor-course-row-main">
                  <Link href={`/instructor/courses/${course.id}`}>{course.title}</Link>
                  <span>{course.language} · {course.difficulty.toLowerCase()} · {course.category?.name || "Uncategorized"}</span>
                  <span>{course.short_description || "No short description yet."}</span>
                </div>
                <div className="instructor-course-row-meta">
                  <InstructorStatus status={course.status} />
                  <span>{course.updated_at ? new Date(course.updated_at).toLocaleDateString("en", { dateStyle: "medium" }) : "—"}</span>
                </div>
                <Link className="instructor-button-link is-subtle" href={`/instructor/courses/${course.id}`}>Manage</Link>
              </article>
            ))}
          </div>
        ) : (
          <InstructorEmptyState
            title={query || status !== "ALL" ? "No courses match these filters" : "No courses yet"}
            description="Create a course draft to start building your teaching portfolio."
            href="/instructor/courses/new"
            actionLabel="Create your first course"
          />
        )}
      </InstructorPanel>
    </div>
  );
}
