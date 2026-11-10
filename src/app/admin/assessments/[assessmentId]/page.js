import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  AdminAssessmentModerationForm,
  AdminAttemptReviewForm,
} from "@/components/admin/admin-forms";
import {
  AdminPageHeader,
  AdminPanel,
  AdminPagination,
  AdminStatus,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminAssessment } from "@/lib/admin/data";

export const metadata = { title: "Assessment review", robots: { index: false, follow: false } };

export default async function AdminAssessmentDetailPage({ params, searchParams }) {
  const [{ assessmentId }, filters] = await Promise.all([
    params,
    searchParams || Promise.resolve({}),
  ]);
  const {
    assessment,
    course,
    participation,
    attempts,
    attemptPage,
    attemptPageSize,
    attemptTotal,
    history,
  } = await getAdminAssessment(assessmentId, filters);
  return (
    <div className="student-page admin-page">
      <Link className="admin-back-link" href="/admin/assessments"><ArrowLeft size={15} /> Back to assessments</Link>
      <AdminPageHeader
        eyebrow="Assessment oversight"
        title={assessment.title}
        description={<span>Associated with <Link href={`/admin/courses/${course.id}`}>{course.title}</Link> · <AdminStatus value={assessment.is_published ? "PUBLISHED" : "UNPUBLISHED"} /></span>}
      />
      <section className="admin-stat-grid admin-stat-grid-compact" aria-label="Assessment participation">
        <article className="admin-stat-card"><span className="admin-stat-label">Total attempts</span><strong>{Number(participation.attempts).toLocaleString()}</strong><span className="admin-stat-detail">Across all learners</span></article>
        <article className="admin-stat-card"><span className="admin-stat-label">Graded attempts</span><strong>{Number(participation.graded).toLocaleString()}</strong><span className="admin-stat-detail">Finalized results only</span></article>
        <article className="admin-stat-card"><span className="admin-stat-label">Mean score</span><strong>{participation.averagePercent === null ? "—" : `${participation.averagePercent}%`}</strong><span className="admin-stat-detail">Graded attempts only</span></article>
      </section>
      <div className="admin-detail-grid">
        <AdminPanel eyebrow="Existing assessment engine" title="Configuration">
          <dl className="admin-detail-list">
            <div><dt>Course</dt><dd><Link href={`/admin/courses/${course.id}`}>{course.title}</Link></dd></div>
            <div><dt>Instructor</dt><dd><Link href={`/admin/instructors/${course.instructor_id}`}>View instructor</Link></dd></div>
            <div><dt>Type</dt><dd>{assessment.assessment_type.toLowerCase()}</dd></div>
            <div><dt>Time limit</dt><dd>{assessment.time_limit_seconds ? `${Math.ceil(assessment.time_limit_seconds / 60)} minutes` : "No time limit"}</dd></div>
            <div><dt>Passing score</dt><dd>{assessment.passing_score === null ? "Not specified" : `${assessment.passing_score}%`}</dd></div>
            <div><dt>Maximum attempts</dt><dd>{assessment.maximum_attempts ?? "Unlimited"}</dd></div>
            <div><dt>Question order</dt><dd>{assessment.randomize_questions ? "Randomized" : "Fixed"}</dd></div>
            <div><dt>Result review</dt><dd>{assessment.allow_result_review ? "Enabled" : "Disabled"}</dd></div>
            <div><dt>Created</dt><dd>{formatAdminDate(assessment.created_at)}</dd></div>
          </dl>
          {assessment.description && <div className="admin-prose"><h3>Description</h3><p>{assessment.description}</p></div>}
          <p className="admin-capability-note">Answer keys, explanations, correct-option flags, and learner responses are intentionally omitted from this oversight view.</p>
        </AdminPanel>
        <AdminPanel eyebrow="Moderation" title="Publication control">
          <AdminAssessmentModerationForm assessment={assessment} />
        </AdminPanel>
      </div>
      <AdminPanel
        eyebrow="Manual review"
        title={`Attempt review (${attemptTotal})`}
      >
        <p className="admin-capability-note">
          Attempts are not automatically labeled suspicious. Administrators
          may flag an attempt for follow-up or clear an existing flag; each
          decision and reason is retained.
        </p>
        {attempts.length ? (
          <div className="admin-attempt-review-list">
            {attempts.map((attempt) => (
              <article
                className="admin-attempt-review-card"
                key={attempt.attempt_id}
              >
                <header className="admin-attempt-review-heading">
                  <div>
                    <strong>{attempt.student_name}</strong>
                    <p>
                      Attempt {attempt.attempt_number} · Started{" "}
                      {formatAdminDate(attempt.started_at, { time: true })}
                      {attempt.submitted_at
                        ? ` · Submitted ${formatAdminDate(attempt.submitted_at, { time: true })}`
                        : " · Not submitted"}
                      {attempt.is_expired ? " · Time expired" : ""}
                    </p>
                  </div>
                  <AdminStatus value={attempt.attempt_status} />
                  <AdminStatus value={attempt.review_status || "NOT_REVIEWED"} />
                  <strong>
                    {attempt.score === null
                      ? "—"
                      : `${attempt.score} / ${attempt.total_points}`}
                  </strong>
                </header>
                <AdminAttemptReviewForm
                  assessmentId={assessment.id}
                  attempt={attempt}
                />
                {attempt.reviewHistory.length > 0 && (
                  <details className="admin-attempt-review-history">
                    <summary>Review history ({attempt.reviewHistory.length})</summary>
                    {attempt.reviewHistory.map((event) => (
                      <p key={event.id}>
                        {event.review_status.toLowerCase()} · {event.review_note} ·{" "}
                        {formatAdminDate(event.created_at, { time: true })}
                      </p>
                    ))}
                  </details>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-muted">No learner attempts are available for review.</p>
        )}
        <AdminPagination
          page={attemptPage}
          pageSize={attemptPageSize}
          total={attemptTotal}
        />
      </AdminPanel>
      <AdminPanel eyebrow="Immutable moderation trail" title="Assessment history">
        {history.length ? (
          <div className="admin-record-list">
            {history.map((entry) => (
              <article className="admin-record-row" key={entry.id}>
                <div><strong>{entry.action.replaceAll(".", " ")}</strong><p>{entry.metadata.previous_is_published ? "Published" : "Unpublished"} → {entry.metadata.is_published ? "Published" : "Unpublished"} · {formatAdminDate(entry.created_at, { time: true })}</p>{entry.reason && <p>{entry.reason}</p>}</div>
              </article>
            ))}
          </div>
        ) : <p className="admin-muted">No moderation decisions have been recorded.</p>}
      </AdminPanel>
    </div>
  );
}
