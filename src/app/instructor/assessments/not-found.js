import Link from "next/link";

export default function InstructorAssessmentNotFound() {
  return (
    <main className="student-page instructor-page">
      <section className="instructor-empty-state">
        <h1>Assessment not found</h1>
        <p>
          This assessment may have been removed or may not belong to a course
          you manage.
        </p>
        <Link className="instructor-button-link" href="/instructor/assessments">
          Back to assessments
        </Link>
      </section>
    </main>
  );
}
