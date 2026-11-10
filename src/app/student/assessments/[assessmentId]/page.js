import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, Clock3, FileQuestion } from "lucide-react";
import { AssessmentStartButton } from "@/components/student/assessment-components";
import { getStudentAssessment } from "@/lib/student/assessments";

export const metadata = {
  title: "Assessment details",
  robots: { index: false, follow: false },
};

function availabilityMessage(assessment) {
  const now = new Date().getTime();
  if (
    assessment.available_from &&
    now < new Date(assessment.available_from).getTime()
  ) {
    return `Available from ${new Date(assessment.available_from).toLocaleString()}.`;
  }
  if (
    assessment.available_until &&
    now >= new Date(assessment.available_until).getTime()
  ) {
    return `Availability ended ${new Date(assessment.available_until).toLocaleString()}.`;
  }
  return null;
}

export default async function StudentAssessmentDetailPage({ params }) {
  await connection();
  const { assessmentId } = await params;
  const assessment = await getStudentAssessment(assessmentId);
  const activeAttempt = assessment.attempts.find(
    (attempt) => attempt.status === "IN_PROGRESS",
  );
  const scheduleMessage = availabilityMessage(assessment);

  return (
    <div className="student-page assessments-page">
      <Link className="learning-back-link" href="/student/assessments">
        <ArrowLeft size={16} aria-hidden="true" /> All assessments
      </Link>
      <section className="assessment-detail-panel">
        <p className="student-eyebrow">
          {assessment.course?.title || "Course assessment"} ·{" "}
          {assessment.assessment_type === "EXAM" ? "Examination" : "Practice"}
        </p>
        <h1>{assessment.title}</h1>
        <p className="assessment-detail-description">
          {assessment.description || "Review your learning with this assessment."}
        </p>
        {assessment.instructions && (
          <div className="assessment-instructions">
            <h2>Before you begin</h2>
            <p>{assessment.instructions}</p>
          </div>
        )}
        <div className="assessment-detail-facts">
          <span>
            <FileQuestion size={17} aria-hidden="true" />
            {assessment.questions.length}{" "}
            {assessment.questions.length === 1 ? "question" : "questions"}
          </span>
          {assessment.time_limit_seconds && (
            <span>
              <Clock3 size={17} aria-hidden="true" />
              {Math.ceil(assessment.time_limit_seconds / 60)} minutes
            </span>
          )}
          {assessment.maximum_attempts && (
            <span>
              {assessment.maximum_attempts}{" "}
              {assessment.maximum_attempts === 1 ? "attempt" : "attempts"} maximum
            </span>
          )}
          {assessment.passing_score !== null && (
            <span>Passing score: {assessment.passing_score}%</span>
          )}
        </div>
        <p className="assessment-timing-note">
          Your answers save automatically. Leaving the page will not stop the
          timer.
        </p>
        {activeAttempt ? (
          <Link
            className="ui-button ui-button-primary ui-button-md"
            href={`/student/assessments/${assessment.id}/attempt?attemptId=${activeAttempt.id}`}
          >
            Continue active attempt <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : scheduleMessage ? (
          <p className="assessment-availability-note" role="status">
            {scheduleMessage}
          </p>
        ) : (
          <AssessmentStartButton assessment={assessment} />
        )}
      </section>

      {assessment.attempts.length > 0 && (
        <section className="assessment-previous-attempts">
          <header className="student-panel-heading">
            <div>
              <p className="student-eyebrow">Your work</p>
              <h2>Previous attempts</h2>
            </div>
          </header>
          <ul>
            {assessment.attempts.map((attempt) => (
              <li key={attempt.id}>
                <span>
                  Attempt {attempt.attempt_number} ·{" "}
                  {attempt.status === "IN_PROGRESS"
                    ? "In progress"
                    : attempt.status === "PENDING_REVIEW"
                      ? "Awaiting review"
                      : "Graded"}
                </span>
                {attempt.submitted_at ? (
                  <Link href={`/student/assessments/${assessment.id}/result/${attempt.id}`}>
                    View result <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                ) : (
                  <Link
                    href={`/student/assessments/${assessment.id}/attempt?attemptId=${attempt.id}`}
                  >
                    Resume <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
