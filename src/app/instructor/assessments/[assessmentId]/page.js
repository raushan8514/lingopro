import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import {
  InstructorDeleteForm,
  InstructorAssessmentForm,
  InstructorGradeForm,
  InstructorPublishForm,
  InstructorQuestionForm,
  InstructorQuestionReorderButtons,
  InstructorQuestionBankImportForm,
  InstructorQuestionBankSaveForm,
} from "@/components/instructor/instructor-forms";
import { deleteInstructorQuestion } from "@/app/instructor/actions";
import {
  formatInstructorDateTime,
  InstructorEmptyState,
  InstructorPageHeader,
  InstructorPanel,
  InstructorStatus,
} from "@/components/instructor/instructor-components";
import { getInstructorAssessment } from "@/lib/instructor/data";

export const metadata = {
  title: "Assessment management",
  robots: { index: false, follow: false },
};

function answerText(answer) {
  if (answer.answer_text) return answer.answer_text;
  return answer.options?.length
    ? answer.options.map((option) => option.option_text).join(", ")
    : "No written response";
}

export default async function InstructorAssessmentDetailPage({ params }) {
  const { assessmentId } = await params;
  const { course, sections, assessment, questionBankItems } =
    await getInstructorAssessment(assessmentId);
  const hasAttempts = assessment.attempts.length > 0;
  const canEditQuestions = !hasAttempts && !assessment.is_published;
  const pendingReviews = assessment.attempts.filter((attempt) => attempt.status === "PENDING_REVIEW");

  return (
    <div className="student-page instructor-page">
      <Link className="instructor-back-link" href={`/instructor/courses/${course.id}/assessments`}><ArrowLeft size={15} /> Back to course assessments</Link>
      <InstructorPageHeader
        eyebrow={`${course.title} · ${assessment.assessment_type.toLowerCase()}`}
        title={assessment.title}
        description={assessment.description || "Manage assessment settings, questions, publication, and learner results."}
      />
      <section className="instructor-assessment-summary">
        <div>
          <InstructorStatus status={assessment.is_published ? "PUBLISHED" : "DRAFT"} />
          <span>{assessment.questions.length} questions</span>
          <span>{assessment.attempts.length} learner attempts</span>
          {pendingReviews.length > 0 && <span>{pendingReviews.length} pending manual review</span>}
        </div>
        <InstructorPublishForm courseId={course.id} assessment={assessment} />
      </section>

      <InstructorPanel
        eyebrow="Assessment setup"
        title={hasAttempts ? "Settings locked after first attempt" : "Assessment settings"}
      >
        {hasAttempts ? (
          <p className="instructor-form-help">Settings that affect scoring and question behavior are locked once an attempt has started, preserving consistent grading for learners.</p>
        ) : (
          <InstructorAssessmentForm
            courseId={course.id}
            sections={sections}
            assessment={assessment}
          />
        )}
      </InstructorPanel>

      <InstructorPanel
        eyebrow="Authoring"
        title={`Questions (${assessment.questions.length})`}
        className="instructor-question-panel"
      >
        {assessment.questions.length > 0 && (
          <details className="instructor-assessment-preview">
            <summary>Preview learner experience</summary>
            <ol>
              {assessment.questions.map((question) => (
                <li key={question.id}>
                  <div>
                    <span className="instructor-eyebrow">
                      {question.question_type.replaceAll("_", " ").toLowerCase()} · {question.points} points
                    </span>
                    <p>{question.question_text}</p>
                  </div>
                  {question.options.length > 0 && (
                    <ul>
                      {question.options.map((option) => (
                        <li key={option.id}>{option.option_text}</li>
                      ))}
                    </ul>
                  )}
                  {question.question_type === "MATCHING" && (
                    <p className="instructor-form-help">Learners will match each prompt with one answer.</p>
                  )}
                  {["SHORT_ANSWER", "LONG_ANSWER", "FILL_IN_THE_BLANK"].includes(question.question_type) &&
                    question.grading_mode === "MANUAL" && (
                      <p className="instructor-form-help">Learner responses will be reviewed by an instructor.</p>
                    )}
                </li>
              ))}
            </ol>
          </details>
        )}
        {assessment.is_published && !hasAttempts && (
          <p className="instructor-lock-note">Unpublish this assessment before adding, editing, or deleting questions.</p>
        )}
        {assessment.questions.length ? (
          <div className="instructor-question-list">
            {assessment.questions.map((question, index) => (
              <article className="instructor-question-card" key={question.id}>
                <header>
                  <div>
                    <p className="instructor-eyebrow">Question {index + 1} · {question.question_type.replaceAll("_", " ").toLowerCase()} · {question.points} points{question.difficulty ? ` · ${question.difficulty.toLowerCase()}` : ""}</p>
                    <h3>{question.question_text}</h3>
                  </div>
                  {canEditQuestions && (
                    <InstructorQuestionReorderButtons
                      courseId={course.id}
                      assessmentId={assessment.id}
                      items={assessment.questions}
                      itemId={question.id}
                    />
                  )}
                </header>
                {question.options.length > 0 && (
                  <ul className="instructor-question-options">
                    {question.options.map((option) => (
                      <li className={option.is_correct ? "is-correct" : ""} key={option.id}>
                        {option.is_correct && <span aria-label="Correct answer">Correct · </span>}
                        {option.option_text}
                      </li>
                    ))}
                  </ul>
                )}
                {question.question_type === "MATCHING" && question.matching_pairs.length > 0 && (
                  <p className="instructor-form-help">
                    Correct matches: {question.matching_pairs.map((pair) => `${pair.prompt} → ${pair.answer}`).join(" · ")}
                  </p>
                )}
                {question.question_type === "FILL_IN_THE_BLANK" && question.answer_key && (
                  <p className="instructor-form-help">Accepted answer: {question.answer_key}</p>
                )}
                {question.explanation && <p className="instructor-form-help">Explanation: {question.explanation}</p>}
                {question.resource_links?.length > 0 && (
                  <ul className="instructor-question-resources">
                    {question.resource_links.map((resource) => (
                      <li key={`${resource.label}-${resource.url}`}>
                        <a href={resource.url} rel="noreferrer" target="_blank">{resource.label}</a>
                      </li>
                    ))}
                  </ul>
                )}
                {!canEditQuestions ? (
                  <p className="instructor-lock-note">
                    {hasAttempts
                      ? "Question editing is disabled because learner attempts exist."
                      : "Unpublish the assessment before changing its questions."}
                  </p>
                ) : (
                  <>
                    <details className="instructor-edit-details">
                      <summary>Edit question</summary>
                      <InstructorQuestionForm
                        courseId={course.id}
                        assessmentId={assessment.id}
                        question={question}
                      />
                    </details>
                    <InstructorDeleteForm
                      action={deleteInstructorQuestion}
                      fields={{ course_id: course.id, assessment_id: assessment.id, question_id: question.id }}
                      label="Delete question"
                    />
                    {!question.is_in_question_bank && (
                      <InstructorQuestionBankSaveForm
                        courseId={course.id}
                        assessmentId={assessment.id}
                        questionId={question.id}
                      />
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
        ) : (
          <InstructorEmptyState
            title="Add the first question"
            description="Assessments must have at least one valid question before they can be published."
            icon={ClipboardCheck}
          />
        )}
        {canEditQuestions && questionBankItems.length > 0 && (
          <details className="instructor-add-lesson">
            <summary><ClipboardCheck size={16} /> Import from course question bank ({questionBankItems.length})</summary>
            <InstructorQuestionBankImportForm
              courseId={course.id}
              assessmentId={assessment.id}
              items={questionBankItems}
            />
          </details>
        )}
        {canEditQuestions && (
          <details className="instructor-add-lesson">
            <summary><ClipboardCheck size={16} /> Add question</summary>
            <InstructorQuestionForm courseId={course.id} assessmentId={assessment.id} />
          </details>
        )}
      </InstructorPanel>

      <InstructorPanel
        eyebrow="Learner outcomes"
        title="Attempts and manual grading"
      >
        {assessment.attempts.length ? (
          <div className="instructor-attempt-list">
            {assessment.attempts.map((attempt) => (
              <article className="instructor-attempt-card" key={attempt.id}>
                <header className="instructor-attempt-heading">
                  <div>
                    <strong>{attempt.studentName}</strong>
                    <span>Started {formatInstructorDateTime(attempt.started_at)} · {attempt.submitted_at ? `Submitted ${formatInstructorDateTime(attempt.submitted_at)}` : "Not submitted"}</span>
                  </div>
                  <InstructorStatus status={attempt.status} />
                  <span className="instructor-attempt-score">
                    {attempt.score === null ? "—" : `${attempt.score} / ${attempt.total_points}`}
                  </span>
                </header>
                {attempt.answers.length > 0 && (
                  <div className="instructor-response-list">
                    {attempt.answers.map((answer) => (
                      <section className="instructor-response" key={answer.id}>
                        <div>
                          <strong>{answer.question?.question_text || "Assessment question"}</strong>
                          <p>{answerText(answer)}</p>
                          <span>{answer.awarded_points === null ? "Not graded" : `${answer.awarded_points} points awarded`} · max {answer.question?.points ?? 0}</span>
                        </div>
                        {attempt.status === "PENDING_REVIEW" &&
                          answer.awarded_points === null &&
                          answer.question?.grading_mode === "MANUAL" && (
                          <InstructorGradeForm answerId={answer.id} maxPoints={answer.question.points} />
                        )}
                      </section>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <InstructorEmptyState
            title="No attempts yet"
            description="Submitted learner attempts and grading actions will appear here."
          />
        )}
      </InstructorPanel>
    </div>
  );
}
