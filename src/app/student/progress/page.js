import Link from "next/link";
import {
  Activity,
  Award,
  BookOpen,
  CheckCircle2,
  Flame,
  Target,
} from "lucide-react";
import StudentLearningChart from "@/components/student/student-charts";
import {
  StudentCourseCard,
  StudentPageHeader,
  StudentStatCard,
} from "@/components/student/student-components";
import { getStudentProgressPageData } from "@/lib/student/data";

export const metadata = {
  title: "Learning progress",
  robots: { index: false, follow: false },
};

function rangeUrl(range) {
  return range === 30 ? "/student/progress" : `/student/progress?range=${range}`;
}

export default async function StudentProgressPage({ searchParams }) {
  const params = await searchParams;
  const data = await getStudentProgressPageData(params.range);

  return (
    <div className="student-page">
      <StudentPageHeader
        eyebrow="Measured from real activity"
        title="Your progress"
        description="A clear view of published lessons, graded quiz attempts, and recorded learning activity."
      />

      <section className="student-stat-grid student-progress-stats">
        <StudentStatCard
          Icon={BookOpen}
          label="Published lessons"
          value={data.totalLessons}
          detail="In courses you can currently access"
        />
        <StudentStatCard
          Icon={CheckCircle2}
          label="Completed lessons"
          value={data.completedLessons}
          detail={data.totalLessons ? `${data.overallProgress}% overall progress` : "No lessons available yet"}
          tone="blue"
        />
        <StudentStatCard
          Icon={Activity}
          label="Quiz average"
          value={data.quizAverage === null ? "—" : `${data.quizAverage}%`}
          detail={data.quizAverage === null ? "No graded quiz results yet" : `${data.quizAttemptCount} submitted attempts`}
          tone="violet"
        />
        <StudentStatCard
          Icon={Flame}
          label="Current streak"
          value={`${data.currentStreak} ${data.currentStreak === 1 ? "day" : "days"}`}
          detail={`Longest recorded: ${data.longestStreak} ${data.longestStreak === 1 ? "day" : "days"}`}
          tone="orange"
        />
      </section>

      <section className="student-panel student-analytics-panel">
        <header className="student-panel-heading student-analytics-heading">
          <div>
            <p className="student-eyebrow">Learning activity over time</p>
            <h2>Recent activity</h2>
          </div>
          <nav className="student-range-tabs" aria-label="Chart date range">
            {[7, 30, 90].map((range) => (
              <Link
                href={rangeUrl(range)}
                key={range}
                aria-current={data.range === range ? "page" : undefined}
                className={data.range === range ? "is-active" : ""}
              >
                {range} days
              </Link>
            ))}
          </nav>
        </header>
        <StudentLearningChart
          data={data.chart}
          timeZone={data.goals.timezone}
          range={data.range}
        />
      </section>

      <section className="student-panel">
        <header className="student-panel-heading">
          <div>
            <p className="student-eyebrow">Course by course</p>
            <h2>Learning overview</h2>
          </div>
          <Link className="student-inline-link" href="/student/courses">
            Course library <span aria-hidden="true">→</span>
          </Link>
        </header>
        {data.courses.length ? (
          <div className="student-course-list">
            {data.courses.map((course) => (
              <StudentCourseCard course={course} compact key={course.id} />
            ))}
          </div>
        ) : (
          <div className="student-library-empty">
            <Target size={23} aria-hidden="true" />
            <h3>No course progress yet</h3>
            <p>Enroll in a course to see lesson completion and progress here.</p>
            <Link className="student-inline-link" href="/courses">Browse courses</Link>
          </div>
        )}
      </section>

      <p className="student-data-note">
        Learning duration is not shown because the platform does not yet record reliable study-time data.
        Quiz results exclude attempts awaiting manual grading.
      </p>
    </div>
  );
}
