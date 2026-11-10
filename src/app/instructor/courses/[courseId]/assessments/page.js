import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  InstructorEmptyState,
  InstructorPageHeader,
  InstructorPanel,
  InstructorStatus,
} from "@/components/instructor/instructor-components";
import { getInstructorCourse } from "@/lib/instructor/data";

export const metadata = {
  title: "Course assessments",
  robots: { index: false, follow: false },
};

export default async function InstructorCourseAssessmentsPage({ params }) {
  const { courseId } = await params;
  const { course, assessments } = await getInstructorCourse(courseId, {
    includeAnswerKeys: false,
    includeProgress: false,
    includeCategories: false,
    includeResponses: false,
    includeRoster: false,
  });

  return (
    <div className="student-page instructor-page">
      <Link className="instructor-back-link" href={`/instructor/courses/${courseId}`}><ArrowLeft size={15} /> Back to course</Link>
      <InstructorPageHeader
        eyebrow={course.title}
        title="Course assessments"
        description="Build practice assessments and exams. Learner results stay scoped to this course."
        actionHref={`/instructor/courses/${courseId}/assessments/new`}
        actionLabel="Create assessment"
      />
      <InstructorPanel eyebrow="Assessments" title={`${assessments.length} item${assessments.length === 1 ? "" : "s"}`}>
        {assessments.length ? (
          <div className="instructor-course-list">
            {assessments.map((assessment) => (
              <article className="instructor-course-row instructor-course-row-card" key={assessment.id}>
                <div className="instructor-course-row-main">
                  <Link href={`/instructor/assessments/${assessment.id}`}>{assessment.title}</Link>
                  <span>{assessment.assessment_type.toLowerCase()} · {assessment.questions.length} question{assessment.questions.length === 1 ? "" : "s"} · {assessment.attempts.length} attempt{assessment.attempts.length === 1 ? "" : "s"}</span>
                  {assessment.description && <span>{assessment.description}</span>}
                </div>
                <InstructorStatus status={assessment.is_published ? "PUBLISHED" : "DRAFT"} />
                <Link className="instructor-row-action" href={`/instructor/assessments/${assessment.id}`} aria-label={`Manage ${assessment.title}`}><ArrowRight size={17} /></Link>
              </article>
            ))}
          </div>
        ) : (
          <InstructorEmptyState
            title="No assessments yet"
            description="Create an assessment draft, add questions, then publish it for enrolled learners."
            href={`/instructor/courses/${courseId}/assessments/new`}
            actionLabel="Create assessment"
          />
        )}
      </InstructorPanel>
    </div>
  );
}
