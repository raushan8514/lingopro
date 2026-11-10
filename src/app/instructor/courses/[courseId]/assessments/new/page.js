import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InstructorAssessmentForm } from "@/components/instructor/instructor-forms";
import {
  InstructorPageHeader,
  InstructorPanel,
} from "@/components/instructor/instructor-components";
import { getInstructorCourse } from "@/lib/instructor/data";

export const metadata = {
  title: "Create an assessment",
  robots: { index: false, follow: false },
};

export default async function NewInstructorAssessmentPage({ params }) {
  const { courseId } = await params;
  const { course, sections } = await getInstructorCourse(courseId, {
    includeAssessments: false,
    includeAnswerKeys: false,
    includeAttempts: false,
    includeCategories: false,
    includeProgress: false,
    includeResponses: false,
    includeRoster: false,
  });
  return (
    <div className="student-page instructor-page">
      <Link className="instructor-back-link" href={`/instructor/courses/${courseId}/assessments`}><ArrowLeft size={15} /> Back to assessments</Link>
      <InstructorPageHeader
        eyebrow={course.title}
        title="Create assessment"
        description="Configure scoring and availability. Add and verify questions before publishing."
      />
      <InstructorPanel eyebrow="Unpublished draft" title="Assessment settings">
        <InstructorAssessmentForm courseId={courseId} sections={sections} />
      </InstructorPanel>
    </div>
  );
}
