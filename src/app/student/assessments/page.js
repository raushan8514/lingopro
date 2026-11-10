import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { AssessmentCard } from "@/components/student/assessment-components";
import { getStudentAssessments } from "@/lib/student/assessments";

export const metadata = {
  title: "Assessments",
  robots: { index: false, follow: false },
};

export default async function StudentAssessmentsPage() {
  await connection();
  const assessments = await getStudentAssessments();

  return (
    <div className="student-page assessments-page">
      <header className="assessment-page-header">
        <div>
          <p className="student-eyebrow">Practice that moves you forward</p>
          <h1>Assessments</h1>
          <p>
            Check your understanding, review your results, and pick up where you
            left off.
          </p>
        </div>
        <Link className="ui-button ui-button-outline ui-button-md" href="/student/assessments/history">
          Attempt history <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>

      {assessments.length ? (
        <section className="assessment-list" aria-label="Available assessments">
          {assessments.map((assessment) => (
            <AssessmentCard assessment={assessment} key={assessment.id} />
          ))}
        </section>
      ) : (
        <section className="assessment-empty-state">
          <BookOpenCheck size={26} aria-hidden="true" />
          <h2>No assessments available yet</h2>
          <p>Published assessments for your enrolled courses will appear here.</p>
          <Link className="ui-button ui-button-primary ui-button-md" href="/student/courses">
            Browse my courses
          </Link>
        </section>
      )}
    </div>
  );
}
