import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminCourseModerationForm } from "@/components/admin/admin-forms";
import {
  AdminPageHeader,
  AdminPanel,
  AdminStatus,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminCourse } from "@/lib/admin/data";

export const metadata = { title: "Course review", robots: { index: false, follow: false } };

export default async function AdminCourseDetailPage({ params }) {
  const { courseId } = await params;
  const data = await getAdminCourse(courseId);
  const { course } = data;
  return (
    <div className="student-page admin-page">
      <Link className="admin-back-link" href="/admin/courses"><ArrowLeft size={15} /> Back to courses</Link>
      <AdminPageHeader
        eyebrow="Course review"
        title={course.title}
        description={course.short_description || "Review course details, curriculum, and learning resources before moderation."}
      />
      <div className="admin-course-meta">
        <AdminStatus value={course.status} />
        <span>{course.language} · {course.difficulty.toLowerCase()}</span>
        <span>{data.enrollmentCount.toLocaleString()} enrollments</span>
        <span>Updated {formatAdminDate(course.updated_at)}</span>
      </div>
      <div className="admin-detail-grid">
        <AdminPanel eyebrow="Course record" title="Description and ownership">
          <dl className="admin-detail-list">
            <div><dt>Instructor</dt><dd><Link href={`/admin/instructors/${data.instructor?.id}`}>{data.instructor?.full_name || "Instructor account"}</Link> · {data.instructor?.email}</dd></div>
            <div><dt>Category</dt><dd>{data.category?.name || "Unassigned"}</dd></div>
            <div><dt>Course slug</dt><dd>{course.slug}</dd></div>
            <div><dt>Created</dt><dd>{formatAdminDate(course.created_at)}</dd></div>
            <div><dt>Published</dt><dd>{formatAdminDate(course.published_at)}</dd></div>
            <div><dt>Price</dt><dd>{course.price_cents === 0 ? "Free" : `${course.currency} ${(course.price_cents / 100).toFixed(2)}`} · published paid courses use verified Razorpay checkout</dd></div>
          </dl>
          {course.description && <div className="admin-prose"><h3>Course description</h3><p>{course.description}</p></div>}
          {course.learning_outcomes?.length > 0 && (
            <div className="admin-prose">
              <h3>Learning outcomes</h3>
              <ul>{course.learning_outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
            </div>
          )}
          {course.prerequisites && <div className="admin-prose"><h3>Prerequisites</h3><p>{course.prerequisites}</p></div>}
          {course.target_audience && <div className="admin-prose"><h3>Target audience</h3><p>{course.target_audience}</p></div>}
        </AdminPanel>
        <AdminPanel eyebrow="Admin-only operation" title="Moderation decision">
          <AdminCourseModerationForm course={course} />
        </AdminPanel>
      </div>

      <AdminPanel eyebrow="Curriculum review" title={`${data.sections.length} sections`}>
        {data.sections.length ? (
          <div className="admin-curriculum-list">
            {data.sections.map((section) => (
              <details className="admin-curriculum-section" key={section.id}>
                <summary>
                  <span><strong>{section.position + 1}. {section.title}</strong><small>{section.lessons.length} lesson{section.lessons.length === 1 ? "" : "s"}</small></span>
                  <span className="admin-muted">{section.description}</span>
                </summary>
                <div className="admin-curriculum-lessons">
                  {section.lessons.sort((a, b) => a.position - b.position).map((lesson) => (
                    <article key={lesson.id}>
                      <div>
                        <strong>{lesson.title}</strong>
                        <p>{lesson.content_type.toLowerCase()} · {lesson.duration_seconds ? `${Math.ceil(lesson.duration_seconds / 60)} min` : "duration not set"}</p>
                        {lesson.description && <p>{lesson.description}</p>}
                      </div>
                      <div className="admin-chip-row">
                        <AdminStatus value={lesson.is_published ? "PUBLISHED" : "DRAFT"} />
                        {lesson.is_preview && <span className="admin-chip">Preview</span>}
                      </div>
                      {lesson.lesson_resources.length > 0 && (
                        <ul>
                          {lesson.lesson_resources.map((resource) => (
                            <li key={resource.id}>
                              {resource.title} · {resource.resource_type.toLowerCase()}
                              {resource.external_url && <> · <a href={resource.external_url} target="_blank" rel="noreferrer">Open link <ExternalLink size={12} /></a></>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : <p className="admin-muted">This course has no curriculum sections.</p>}
      </AdminPanel>

      <AdminPanel eyebrow="Assessment inventory" title={`${data.assessments.length} assessments`}>
        {data.assessments.length ? (
          <div className="admin-record-list">
            {data.assessments.map((assessment) => (
              <article className="admin-record-row" key={assessment.id}>
                <div><Link href={`/admin/assessments/${assessment.id}`}>{assessment.title}</Link><p>{assessment.assessment_type.toLowerCase()} · Created {formatAdminDate(assessment.created_at)}</p></div>
                <AdminStatus value={assessment.is_published ? "PUBLISHED" : "UNPUBLISHED"} />
              </article>
            ))}
          </div>
        ) : <p className="admin-muted">No assessments are associated with this course.</p>}
      </AdminPanel>

      <AdminPanel eyebrow="Immutable moderation trail" title="Course history">
        {data.history.length ? (
          <div className="admin-record-list">
            {data.history.map((entry) => (
              <article className="admin-record-row" key={entry.id}>
                <div><strong>{entry.action.replaceAll(".", " ")}</strong><p>{entry.metadata.previous_status || "—"} → {entry.metadata.new_status || "—"} · {formatAdminDate(entry.created_at, { time: true })}</p>{entry.reason && <p>{entry.reason}</p>}</div>
              </article>
            ))}
          </div>
        ) : <p className="admin-muted">No moderation decisions have been recorded.</p>}
      </AdminPanel>
    </div>
  );
}
