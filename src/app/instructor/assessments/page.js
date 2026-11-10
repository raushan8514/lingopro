import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import {
  InstructorEmptyState,
  InstructorPageHeader,
  InstructorPanel,
  InstructorStatus,
} from "@/components/instructor/instructor-components";
import { getInstructorAssessments } from "@/lib/instructor/data";

export const metadata = {
  title: "Assessments",
  robots: { index: false, follow: false },
};

export default async function InstructorAssessmentsPage() {
  const { assessments } = await getInstructorAssessments();

  return (
    <div className="student-page instructor-page">
      <InstructorPageHeader
        eyebrow="Assessment center"
        title="Assessments"
        description="Review your course assessments and check their publication status."
      />
      <InstructorPanel eyebrow="Across your courses" title={`${assessments.length} assessment${assessments.length === 1 ? "" : "s"}`}>
        {assessments.length ? (
          <div className="instructor-course-list">
            {assessments.map((assessment) => (
              <article className="instructor-course-row instructor-course-row-card" key={assessment.id}>
                <span className="instructor-assessment-icon"><ClipboardCheck size={18} aria-hidden="true" /></span>
                <div className="instructor-course-row-main">
                  <Link href={`/instructor/assessments/${assessment.id}`}>{assessment.title}</Link>
                  <span>{assessment.courseTitle} · {assessment.assessment_type.toLowerCase()} · {assessment.questionCount} questions</span>
                </div>
                <InstructorStatus status={assessment.is_published ? "PUBLISHED" : "DRAFT"} />
                <Link className="instructor-row-action" href={`/instructor/assessments/${assessment.id}`} aria-label={`Manage ${assessment.title}`}><ArrowRight size={17} /></Link>
              </article>
            ))}
          </div>
        ) : (
          <InstructorEmptyState
            title="No assessments to review"
            description="Create an assessment from one of your course workspaces."
            href="/instructor/courses"
            actionLabel="Open your courses"
          />
        )}
      </InstructorPanel>
    </div>
  );
}
