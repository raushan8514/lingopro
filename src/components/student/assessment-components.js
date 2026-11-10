import Link from "next/link";
import { ArrowRight, BookOpenCheck, Clock3, FileQuestion } from "lucide-react";
import { StartAssessmentButton } from "@/components/student/assessment-start-button";

function dateLabel(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AssessmentCard({ assessment }) {
  const activeAttempt = assessment.attempts.find(
    (attempt) => attempt.status === "IN_PROGRESS",
  );
  const attemptsUsed = assessment.attempts.length;
  const attemptsLeft =
    assessment.maximum_attempts === null
      ? null
      : Math.max(assessment.maximum_attempts - attemptsUsed, 0);

  return (
    <article className="assessment-card">
      <div className="assessment-card-icon" aria-hidden="true">
        <BookOpenCheck size={20} />
      </div>
      <div className="assessment-card-copy">
        <p className="student-eyebrow">
          {assessment.course?.title || "Course assessment"} ·{" "}
          {assessment.assessment_type === "EXAM" ? "Exam" : "Practice"}
        </p>
        <h2>
          <Link href={`/student/assessments/${assessment.id}`}>
            {assessment.title}
          </Link>
        </h2>
        <p>{assessment.description || "Review your learning with this assessment."}</p>
        <div className="assessment-card-meta">
          <span>
            <FileQuestion size={15} aria-hidden="true" />
            {assessment.questionCount}{" "}
            {assessment.questionCount === 1 ? "question" : "questions"}
          </span>
          {assessment.time_limit_seconds && (
            <span>
              <Clock3 size={15} aria-hidden="true" />
              {Math.ceil(assessment.time_limit_seconds / 60)} min
            </span>
          )}
          {attemptsLeft !== null && (
            <span>
              {attemptsLeft} {attemptsLeft === 1 ? "attempt" : "attempts"} left
            </span>
          )}
        </div>
      </div>
      <div className="assessment-card-action">
        {activeAttempt ? (
          <Link
            className="ui-button ui-button-secondary ui-button-md"
            href={`/student/assessments/${assessment.id}/attempt?attemptId=${activeAttempt.id}`}
          >
            Resume <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : attemptsLeft === 0 ? (
          <span className="assessment-closed-label">Attempts complete</span>
        ) : (
          <Link
            className="ui-button ui-button-secondary ui-button-md"
            href={`/student/assessments/${assessment.id}`}
          >
            View assessment <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

export function AssessmentStartButton({ assessment }) {
  return (
    <StartAssessmentButton
      assessmentId={assessment.id}
      availableFrom={assessment.available_from}
      availableUntil={assessment.available_until}
      maximumAttempts={assessment.maximum_attempts}
      attempts={assessment.attempts}
    />
  );
}

export function AssessmentHistory({ attempts }) {
  if (!attempts.length) {
    return (
      <div className="assessment-empty-state">
        <BookOpenCheck size={25} aria-hidden="true" />
        <h2>No assessment attempts yet</h2>
        <p>Your completed and in-progress assessments will appear here.</p>
        <Link className="ui-button ui-button-primary ui-button-md" href="/student/assessments">
          Browse assessments
        </Link>
      </div>
    );
  }

  return (
    <div className="assessment-history-list">
      {attempts.map((attempt) => {
        const assessment = attempt.assessment || {};
        const score =
          attempt.score === null || Number(attempt.total_points) <= 0
            ? null
            : Math.round((Number(attempt.score) / Number(attempt.total_points)) * 100);
        const submitted = attempt.submitted_at;

        return (
          <article className="assessment-history-row" key={attempt.id}>
            <div className="assessment-history-copy">
              <p className="student-eyebrow">
                {assessment.courses?.title || "Course assessment"} · Attempt{" "}
                {attempt.attempt_number}
              </p>
              <h2>
                {submitted ? (
                  <Link href={`/student/assessments/${attempt.quiz_id}/result/${attempt.id}`}>
                    {assessment.title || "Assessment"}
                  </Link>
                ) : (
                  <Link
                    href={`/student/assessments/${attempt.quiz_id}/attempt?attemptId=${attempt.id}`}
                  >
                    {assessment.title || "Assessment"}
                  </Link>
                )}
              </h2>
              <p>
                {submitted
                  ? `Submitted ${dateLabel(submitted)}${attempt.is_expired ? " · Time expired" : ""}`
                  : `Started ${dateLabel(attempt.started_at)} · In progress`}
              </p>
            </div>
            <div className="assessment-history-result">
              <span className={`assessment-status assessment-status-${attempt.status.toLowerCase()}`}>
                {attempt.status === "PENDING_REVIEW"
                  ? "Awaiting review"
                  : attempt.status === "GRADED"
                    ? "Graded"
                    : "In progress"}
              </span>
              {score !== null && (
                <strong>
                  {score}% <small>({attempt.score}/{attempt.total_points})</small>
                </strong>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
