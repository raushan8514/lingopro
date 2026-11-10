import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3 } from "lucide-react";
import { getStudentQuizAttempt, isAssessmentId } from "@/lib/student/assessments";

export const metadata = {
  title: "Assessment result",
  robots: { index: false, follow: false },
};

function percentage(score, total) {
  if (score === null || Number(total) <= 0) return null;
  return Math.round((Number(score) / Number(total)) * 100);
}

function parseMatchingAnswer(text) {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function QuestionReview({ question }) {
  const awarded = question.awarded_points;
  const matchingAnswers =
    question.question_type === "MATCHING"
      ? parseMatchingAnswer(question.answer_text)
      : {};
  const hasSelection =
    question.selected_option_ids.length > 0 ||
    (question.answer_text && question.answer_text.trim().length > 0);

  return (
    <article className="assessment-review-question">
      <header>
        <div>
          <p className="student-eyebrow">
            Question {question.position + 1} · {question.points}{" "}
            {Number(question.points) === 1 ? "point" : "points"}
          </p>
          <h2>{question.question_text}</h2>
          {question.difficulty && (
            <p className="assessment-question-difficulty">
              Difficulty: {question.difficulty.toLowerCase()}
            </p>
          )}
          {question.resource_links?.length > 0 && (
            <ul className="assessment-question-resources" aria-label="Question resources">
              {question.resource_links.map((resource) => (
                <li key={`${resource.label}-${resource.url}`}>
                  <a href={resource.url} rel="noreferrer" target="_blank">
                    {resource.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <strong className="assessment-awarded-points">
          {awarded === null ? "Pending" : `${awarded} / ${question.points}`}
        </strong>
      </header>
      {question.options.length ? (
        <ul className="assessment-review-options">
          {question.options.map((option) => {
            const selected = question.selected_option_ids.includes(option.id);
            const selectedMatchingAnswer =
              option.selected_matching_answer || matchingAnswers[option.id] || "";
            const isMatchingCorrect =
              option.matching_answer !== null &&
              option.matching_answer !== undefined &&
              selectedMatchingAnswer === option.matching_answer;
            return (
              <li
                className={[
                  selected || selectedMatchingAnswer ? "is-selected" : "",
                  question.question_type === "MATCHING"
                    ? isMatchingCorrect
                      ? "is-correct"
                      : ""
                    : option.is_correct === true
                      ? "is-correct"
                      : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={option.id}
              >
                <span>{option.option_text}</span>
                {question.question_type === "MATCHING" ? (
                  <>
                    {selectedMatchingAnswer && (
                      <span className="assessment-response-label">
                        Your match: {selectedMatchingAnswer}
                      </span>
                    )}
                    {option.matching_answer && (
                      <span className="assessment-correct-label">
                        Correct match: {option.matching_answer}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {selected && <span className="assessment-response-label">Your answer</span>}
                    {option.is_correct === true && (
                  <span className="assessment-correct-label">Correct answer</span>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="assessment-review-response">
          <span>Your response</span>
          {hasSelection ? question.answer_text : "No answer submitted"}
        </p>
      )}
      {question.explanation && (
        <p className="assessment-explanation">{question.explanation}</p>
      )}
    </article>
  );
}

export default async function StudentAssessmentResultPage({ params }) {
  await connection();
  const { assessmentId, attemptId } = await params;
  if (!isAssessmentId(attemptId)) notFound();

  const attempt = await getStudentQuizAttempt(attemptId);
  if (attempt.quiz_id !== assessmentId) notFound();
  if (attempt.status === "IN_PROGRESS") {
    redirect(
      `/student/assessments/${assessmentId}/attempt?attemptId=${attemptId}`,
    );
  }

  const scorePercent = percentage(attempt.score, attempt.total_points);
  const passed =
    attempt.status === "GRADED" &&
    attempt.passing_score !== null &&
    scorePercent !== null &&
    scorePercent >= Number(attempt.passing_score);

  return (
    <div className="student-page assessments-page">
      <Link
        className="learning-back-link"
        href={`/student/assessments/${assessmentId}`}
      >
        <ArrowLeft size={16} aria-hidden="true" /> Assessment details
      </Link>
      <section className="assessment-result-hero">
        <div className="assessment-result-icon" aria-hidden="true">
          {attempt.status === "PENDING_REVIEW" ? (
            <Clock3 size={25} />
          ) : (
            <CheckCircle2 size={26} />
          )}
        </div>
        <p className="student-eyebrow">
          {attempt.assessment_type === "EXAM" ? "Examination result" : "Practice result"}
        </p>
        <h1>{attempt.title}</h1>
        {attempt.status === "PENDING_REVIEW" ? (
          <p>
            Your responses were submitted
            {attempt.is_expired ? " when the time limit ended" : ""}. An instructor
            review is still needed before your result is final.
          </p>
        ) : (
          <p>
            {passed
              ? "Assessment complete — you reached the passing score."
              : attempt.passing_score === null
                ? "Your assessment has been graded."
                : "Assessment complete. Keep practicing and try again when available."}
          </p>
        )}
        {scorePercent !== null && (
          <div className="assessment-result-score">
            <strong>{scorePercent}%</strong>
            <span>
              {attempt.score} of {attempt.total_points} points
              {attempt.status === "PENDING_REVIEW" ? " · provisional" : ""}
            </span>
          </div>
        )}
        {attempt.is_expired && (
          <p className="assessment-expired-note" role="status">
            Time expired. Your saved answers were submitted automatically.
          </p>
        )}
        <div className="assessment-result-actions">
          <Link className="ui-button ui-button-primary ui-button-md" href="/student/assessments">
            Browse assessments
          </Link>
          <Link className="ui-button ui-button-outline ui-button-md" href="/student/assessments/history">
            Attempt history
          </Link>
        </div>
      </section>

      {attempt.allow_result_review && (
        <section className="assessment-review-list">
          <header className="student-panel-heading">
            <div>
              <p className="student-eyebrow">Review</p>
              <h2>Your responses</h2>
            </div>
          </header>
          {attempt.questions.map((question) => (
            <QuestionReview key={question.id} question={question} />
          ))}
        </section>
      )}
    </div>
  );
}
