import Link from "next/link";
import { Activity } from "lucide-react";
import {
  StudentActivityList,
  StudentPageHeader,
} from "@/components/student/student-components";
import { getStudentActivityPageData } from "@/lib/student/data";

export const metadata = {
  title: "Learning activity",
  robots: { index: false, follow: false },
};

const filters = [
  ["all", "All activity"],
  ["COURSE_ENROLLED", "Course enrollments"],
  ["LESSON_STARTED", "Lessons started"],
  ["LESSON_COMPLETED", "Lessons completed"],
  ["QUIZ_ATTEMPTED", "Quizzes submitted"],
  ["QUIZ_PASSED", "Quizzes passed"],
  ["CERTIFICATE_EARNED", "Certificates earned"],
];

function activityPageUrl(page, type) {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/student/activity?${query}` : "/student/activity";
}

export default async function StudentActivityPage({ searchParams }) {
  const params = await searchParams;
  const data = await getStudentActivityPageData({
    page: params.page,
    type: params.type,
  });

  return (
    <div className="student-page">
      <StudentPageHeader
        eyebrow="Your learning timeline"
        title="Learning activity"
        description="A chronological record of actual enrollments, lesson progress, quiz submissions, and issued certificates."
      />
      <section className="student-panel">
        <div className="student-activity-toolbar">
          <span>
            <Activity size={17} aria-hidden="true" />
            {data.total} recorded {data.total === 1 ? "event" : "events"}
          </span>
          <form method="get" action="/student/activity">
            <label>
              <span className="student-sr-only">Filter activity type</span>
              <select
                className="ui-input ui-select"
                name="type"
                defaultValue={data.type}
              >
                {filters.map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <button className="ui-button ui-button-secondary ui-button-sm" type="submit">
              Apply
            </button>
          </form>
        </div>
        <StudentActivityList
          activities={data.activities}
          timeZone={data.goals.timezone}
        />
        {data.totalPages > 1 && (
          <nav className="student-pagination" aria-label="Activity pages">
            <Link
              href={activityPageUrl(Math.max(1, data.page - 1), data.type)}
              aria-disabled={data.page <= 1}
              tabIndex={data.page <= 1 ? -1 : undefined}
            >
              Previous
            </Link>
            <span>Page {data.page} of {data.totalPages}</span>
            <Link
              href={activityPageUrl(Math.min(data.totalPages, data.page + 1), data.type)}
              aria-disabled={data.page >= data.totalPages}
              tabIndex={data.page >= data.totalPages ? -1 : undefined}
            >
              Next
            </Link>
          </nav>
        )}
      </section>
      <p className="student-data-note">
        Activity reflects records currently available in your learning history. No events are created by viewing this page.
      </p>
    </div>
  );
}
