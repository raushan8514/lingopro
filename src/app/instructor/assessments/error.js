"use client";

import Link from "next/link";

export default function InstructorAssessmentError({ reset }) {
  return (
    <main className="student-page instructor-page">
      <section className="instructor-empty-state" role="alert">
        <h1>This assessment could not be loaded</h1>
        <p>
          Your saved assessment data has not been changed. Try again, or return
          to your assessment list.
        </p>
        <div className="instructor-course-shortcuts">
          <button className="instructor-button-link" onClick={reset} type="button">
            Try again
          </button>
          <Link className="instructor-button-link is-subtle" href="/instructor/assessments">
            Back to assessments
          </Link>
        </div>
      </section>
    </main>
  );
}
