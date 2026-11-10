import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  UsersRound,
} from "lucide-react";
import {
  formatInstructorDateTime,
  InstructorEmptyState,
  InstructorMetric,
  InstructorPageHeader,
  InstructorPanel,
  InstructorStatus,
} from "@/components/instructor/instructor-components";
import { getInstructorDashboardData } from "@/lib/instructor/data";

export const metadata = {
  title: "Instructor overview",
  robots: { index: false, follow: false },
};

export default async function InstructorPortalPage() {
  const data = await getInstructorDashboardData();

  return (
    <div className="student-page instructor-page">
      <InstructorPageHeader
        eyebrow={`Teaching workspace · ${data.identity.fullName || "Instructor"}`}
        title="Your teaching overview"
        description="A clear view of your courses, learner activity, and assessment results."
        actionHref="/instructor/courses/new"
        actionLabel="Create course"
      />

      <section className="instructor-metric-grid" aria-label="Teaching statistics">
        <InstructorMetric
          icon={BookOpen}
          label="Your courses"
          value={data.courses.length}
          detail={`${data.courses.filter((course) => course.status === "PUBLISHED").length} published`}
        />
        <InstructorMetric
          icon={UsersRound}
          label="Enrolled learners"
          value={data.totalStudents}
          detail="Across active and completed enrollments"
          tone="blue"
        />
        <InstructorMetric
          icon={CheckCircle2}
          label="Published lessons"
          value={data.totalLessons}
          detail={`${data.completedLessons} recorded completions`}
          tone="violet"
        />
        <InstructorMetric
          icon={ClipboardCheck}
          label="Assessment participation"
          value={data.assessmentParticipation}
          detail={data.averageAssessmentScore === null
            ? "No graded results yet"
            : `${data.averageAssessmentScore}% average score`}
          tone="amber"
        />
      </section>

      <div className="instructor-dashboard-grid">
        <InstructorPanel
          eyebrow="Course portfolio"
          title="Your courses"
          action={<Link className="instructor-inline-link" href="/instructor/courses">All courses <ArrowRight size={15} /></Link>}
        >
          {data.courses.length ? (
            <div className="instructor-course-list">
              {data.courses.slice(0, 6).map((course) => (
                <article className="instructor-course-row" key={course.id}>
                  <div className="instructor-course-row-main">
                    <Link href={`/instructor/courses/${course.id}`}>{course.title}</Link>
                    <span>{course.language} · {course.difficulty.toLowerCase()} · {course.studentCount} learners</span>
                  </div>
                  <InstructorStatus status={course.status} />
                  <Link className="instructor-row-action" href={`/instructor/courses/${course.id}`} aria-label={`Manage ${course.title}`}>
                    <ArrowRight size={17} />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <InstructorEmptyState
              title="Start with a course draft"
              description="Create your first course and organize its lessons before submitting it for review."
              href="/instructor/courses/new"
              actionLabel="Create a course"
            />
          )}
        </InstructorPanel>

        <InstructorPanel eyebrow="Recent learning" title="Learner activity">
          {data.recentActivity.length ? (
            <div className="instructor-activity-list">
              {data.recentActivity.map((item, index) => (
                <article className="instructor-activity-row" key={`${item.lesson_id}-${item.student_id}-${index}`}>
                  <span className="instructor-activity-icon"><Activity size={16} aria-hidden="true" /></span>
                  <div>
                    <strong>{item.lessonTitle}</strong>
                    <span>{item.courseTitle}</span>
                  </div>
                  <time dateTime={item.last_accessed_at || undefined}>{formatInstructorDateTime(item.last_accessed_at)}</time>
                </article>
              ))}
            </div>
          ) : (
            <InstructorEmptyState
              title="No lesson activity yet"
              description="Published lesson activity from enrolled learners will appear here."
            />
          )}
        </InstructorPanel>

        <InstructorPanel
          eyebrow="New enrollments"
          title="Recently joined"
          className="instructor-dashboard-wide"
        >
          {data.recentEnrollments.length ? (
            <div className="instructor-table-wrap">
              <table className="instructor-table">
                <thead><tr><th>Learner</th><th>Course</th><th>Status</th><th>Joined</th></tr></thead>
                <tbody>
                  {data.recentEnrollments.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td>{enrollment.studentName}</td>
                      <td><Link href={`/instructor/courses/${enrollment.course_id}/students`}>{enrollment.courseTitle}</Link></td>
                      <td><InstructorStatus status={enrollment.status} /></td>
                      <td>{formatInstructorDateTime(enrollment.enrolled_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <InstructorEmptyState
              title="No enrollments yet"
              description="Learners enrolled in your courses will appear in this list."
            />
          )}
        </InstructorPanel>
      </div>
    </div>
  );
}
