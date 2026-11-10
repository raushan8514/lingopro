import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  GraduationCap,
  Headphones,
  Link2,
  Video,
} from "lucide-react";
import { Progress } from "@/components/ui/indicators";
import LessonPlayer from "@/components/student/lesson-player";

function routeForLesson(courseId, lessonId) {
  return `/student/courses/${courseId}/learn/${lessonId}`;
}

function durationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 1) return null;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
}

function lessonTypeLabel(type) {
  const labels = {
    VIDEO: "Video",
    AUDIO: "Audio",
    TEXT: "Reading",
    MIXED: "Video & reading",
  };
  return labels[type] || "Lesson";
}

function LessonTypeIcon({ type, size = 15 }) {
  const Icon = type === "VIDEO" ? Video : type === "AUDIO" ? Headphones : BookOpen;
  return <Icon size={size} aria-hidden="true" />;
}

function LearningAssessments({ assessments, lessonId = null }) {
  const visibleAssessments = assessments.filter(
    (assessment) =>
      !lessonId ||
      (assessment.assessment_scope === "LESSON_CHECKPOINT" &&
        assessment.lesson_id === lessonId),
  );
  if (!visibleAssessments.length) return null;

  return (
    <section className="student-panel learning-assessments">
      <header className="student-panel-heading">
        <div>
          <p className="student-eyebrow">Check your understanding</p>
          <h2>Assessments</h2>
        </div>
        <ClipboardCheck size={19} aria-hidden="true" />
      </header>
      <ul>
        {visibleAssessments.map((assessment) => (
          <li key={assessment.id}>
            <div>
              <strong>{assessment.title}</strong>
              <span>
                {assessment.assessment_type === "EXAM" ? "Exam" : "Practice"} ·{" "}
                {assessment.questionCount}{" "}
                {assessment.questionCount === 1 ? "question" : "questions"}
                {assessment.time_limit_seconds
                  ? ` · ${Math.ceil(assessment.time_limit_seconds / 60)} min`
                  : ""}
                {assessment.is_required ? " · Required" : ""}
                {assessment.bestScorePercent !== null
                  ? ` · Best ${assessment.bestScorePercent}%${assessment.passed ? " · Passed" : ""}`
                  : assessment.attempts.some((attempt) => attempt.status === "PENDING_REVIEW")
                    ? " · Pending review"
                    : ""}
              </span>
            </div>
            <Link href={`/student/assessments/${assessment.id}`}>
              View <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CertificateProgress({ eligibility, enrollment }) {
  if (!eligibility?.available) return null;
  const eligible = eligibility.eligible;
  return (
    <section className="student-panel learning-certificate-progress">
      <header className="student-panel-heading">
        <div>
          <p className="student-eyebrow">Certificate eligibility</p>
          <h2>{eligible ? "Requirements satisfied" : "Keep progressing"}</h2>
        </div>
        <GraduationCap size={19} aria-hidden="true" />
      </header>
      <ul>
        <li>
          <span>Lesson completion</span>
          <strong>
            {eligibility.lesson_completion_percent}% /{" "}
            {eligibility.required_lesson_completion_percent}% required
          </strong>
        </li>
        <li>
          <span>Required assessments</span>
          <strong>
            {eligibility.required_assessments_passed} /{" "}
            {eligibility.required_assessments_total} passed
          </strong>
        </li>
        {eligibility.require_final_exam && (
          <li>
            <span>Final examination</span>
            <strong>
              {eligibility.final_exam_passed
                ? "Passed"
                : `Not yet passed · ${eligibility.minimum_final_exam_score}% required`}
            </strong>
          </li>
        )}
      </ul>
      {enrollment.status === "ACTIVE" && eligibility.learning_complete && (
        <p className="student-section-empty" role="status">
          All configured requirements are satisfied. Course completion and certificate
          issuance are being recorded automatically.
        </p>
      )}
      {enrollment.status === "COMPLETED" && eligible && (
        <Link className="student-inline-link" href="/student/achievements">
          View your certificate <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

export function LearningBreadcrumb({ course, currentLesson }) {
  return (
    <nav className="learning-breadcrumb" aria-label="Learning breadcrumb">
      <Link href="/student/courses">My courses</Link>
      <span aria-hidden="true">/</span>
      <Link href={`/student/courses/${course.id}/learn`}>{course.title}</Link>
      {currentLesson && (
        <>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{currentLesson.title}</span>
        </>
      )}
    </nav>
  );
}

export function LearningCourseOverview({ data }) {
  const lessonCount = data.lessons.length;
  const progress = lessonCount
    ? Math.round((data.completedLessons / lessonCount) * 100)
    : 0;
  const nextLesson = data.nextLesson;

  return (
    <div className="student-page learning-page">
      <LearningBreadcrumb course={data.course} />
      <header className="learning-course-overview student-panel">
        <div className="learning-course-overview-copy">
          <p className="student-eyebrow">
            {data.course.language} · {data.course.difficulty.toLowerCase()}
          </p>
          <h1>{data.course.title}</h1>
          <p>
            {data.course.description ||
              data.course.short_description ||
              "Your published lessons are ready when you are."}
          </p>
          {lessonCount > 0 && (
            <div className="learning-overview-progress">
              <Progress
                value={progress}
                label={`${data.completedLessons} of ${lessonCount} lessons completed`}
                showValue
              />
            </div>
          )}
          {nextLesson ? (
            <Link
              className="ui-button ui-button-primary ui-button-md learning-start-button"
              href={routeForLesson(data.course.id, nextLesson.id)}
            >
              {nextLesson.progress?.status === "COMPLETED"
                ? "Review last lesson"
                : nextLesson.progress?.last_accessed_at
                  ? "Continue learning"
                  : "Start learning"}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <p className="learning-empty-message">
              No published lessons are available in this course yet.
            </p>
          )}
        </div>
        <div className="learning-course-overview-art" aria-hidden="true">
          <BookOpen size={54} strokeWidth={1.35} />
        </div>
      </header>

      <LearningAssessments
        assessments={data.assessments.filter(
          (assessment) =>
            !["LESSON_CHECKPOINT", "MODULE"].includes(
              assessment.assessment_scope,
            ),
        )}
      />
      <CertificateProgress
        eligibility={data.certificateEligibility}
        enrollment={data.enrollment}
      />

      <section className="student-panel learning-overview-curriculum">
        <header className="student-panel-heading">
          <div>
            <p className="student-eyebrow">Your learning path</p>
            <h2>Course curriculum</h2>
          </div>
          <span className="learning-lesson-count">
            {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
          </span>
        </header>
        <LearningCurriculum
          courseId={data.course.id}
          sections={data.sections}
          assessments={data.assessments}
        />
      </section>
    </div>
  );
}

export function LearningCurriculum({
  courseId,
  sections,
  assessments = [],
  currentLessonId = null,
}) {
  return (
    <div className="learning-curriculum">
      {sections.map((section, index) => (
        <CurriculumSection
          courseId={courseId}
          section={section}
          assessments={assessments}
          sectionNumber={index + 1}
          currentLessonId={currentLessonId}
          key={section.id}
        />
      ))}
      {!sections.length && (
        <p className="learning-empty-message">
          There are no published lessons in this course yet.
        </p>
      )}
    </div>
  );
}

function CurriculumSection({
  courseId,
  section,
  assessments,
  sectionNumber,
  currentLessonId,
}) {
  const openByDefault =
    section.lessons.some((lesson) => lesson.id === currentLessonId) ||
    sectionNumber === 1;

  return (
    <details
      className="learning-curriculum-section"
      open={openByDefault || undefined}
    >
      <summary>
        <span className="learning-section-number">
          {String(sectionNumber).padStart(2, "0")}
        </span>
        <span className="learning-section-title">{section.title}</span>
        <span className="learning-section-count">
          {section.lessons.length}
        </span>
        <ChevronDown className="learning-section-chevron" size={16} aria-hidden="true" />
      </summary>
      {section.lessons.length ? (
        <ol className="learning-curriculum-lessons">
          {section.lessons.map((lesson) => {
            const active = lesson.id === currentLessonId;
            const completed = lesson.progress?.status === "COMPLETED";
            return (
              <li key={lesson.id}>
                <>
                  <Link
                    className={`learning-curriculum-lesson${active ? " is-active" : ""}${completed ? " is-complete" : ""}`}
                    href={routeForLesson(courseId, lesson.id)}
                    aria-current={active ? "page" : undefined}
                    aria-label={`${lesson.title}, ${lessonTypeLabel(lesson.content_type)}${completed ? ", completed" : ""}`}
                  >
                    <span className="learning-curriculum-status">
                      {completed ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <LessonTypeIcon type={lesson.content_type} size={14} />
                      )}
                    </span>
                    <span className="learning-curriculum-lesson-copy">
                      <strong>{lesson.title}</strong>
                      <span>
                        {lessonTypeLabel(lesson.content_type)}
                        {durationLabel(lesson.duration_seconds) &&
                          ` · ${durationLabel(lesson.duration_seconds)}`}
                      </span>
                    </span>
                    {active && <span className="learning-current-marker">Current</span>}
                  </Link>
                  {assessments
                    .filter(
                      (assessment) =>
                        assessment.assessment_scope === "LESSON_CHECKPOINT" &&
                        assessment.lesson_id === lesson.id,
                    )
                    .map((assessment) => (
                      <AssessmentCurriculumLink
                        assessment={assessment}
                        key={assessment.id}
                      />
                    ))}
                </>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="learning-section-empty">No published lessons in this section.</p>
      )}
      {assessments
        .filter(
          (assessment) =>
            assessment.assessment_scope === "MODULE" &&
            assessment.section_id === section.id,
        )
        .map((assessment) => (
          <AssessmentCurriculumLink assessment={assessment} key={assessment.id} />
        ))}
    </details>
  );
}

function AssessmentCurriculumLink({ assessment }) {
  return (
    <Link
      className="learning-curriculum-assessment"
      href={`/student/assessments/${assessment.id}`}
    >
      <ClipboardCheck size={15} aria-hidden="true" />
      <span>
        <strong>{assessment.title}</strong>
        <small>
          {assessment.assessment_scope === "MODULE" ? "Module assessment" : "Lesson checkpoint"}
          {assessment.is_required ? " · Required" : ""}
          {assessment.passed ? " · Passed" : ""}
          {assessment.bestScorePercent !== null
            ? ` · Best ${assessment.bestScorePercent}%`
            : ""}
        </small>
      </span>
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderContentBlock(block, index) {
  if (!block || typeof block !== "object" || typeof block.type !== "string") {
    return null;
  }
  const text = (value) => (typeof value === "string" ? value : "");

  switch (block.type) {
    case "heading": {
      const heading = text(block.text).trim();
      if (!heading) return null;
      return block.level === 3 ? (
        <h3 key={index}>{heading}</h3>
      ) : (
        <h2 key={index}>{heading}</h2>
      );
    }
    case "paragraph": {
      const paragraph = text(block.text).trim();
      return paragraph ? <p key={index}>{paragraph}</p> : null;
    }
    case "vocabulary": {
      const term = text(block.term).trim();
      const definition = text(block.definition || block.meaning).trim();
      if (!term && !definition) return null;
      return (
        <article className="learning-vocabulary-card" key={index}>
          <strong>{term || "Vocabulary"}</strong>
          {definition && <p>{definition}</p>}
          {text(block.example).trim() && (
            <blockquote>{text(block.example)}</blockquote>
          )}
        </article>
      );
    }
    case "grammar": {
      const title = text(block.title).trim();
      const explanation = text(block.explanation || block.text).trim();
      return (
        <aside className="learning-note-card" key={index}>
          <strong>{title || "Grammar note"}</strong>
          {explanation && <p>{explanation}</p>}
        </aside>
      );
    }
    case "example": {
      const example = text(block.text || block.example).trim();
      if (!example) return null;
      return (
        <figure className="learning-example-card" key={index}>
          <blockquote>{example}</blockquote>
          {text(block.translation).trim() && <figcaption>{text(block.translation)}</figcaption>}
        </figure>
      );
    }
    case "list": {
      const items = Array.isArray(block.items)
        ? block.items.filter((item) => typeof item === "string" && item.trim())
        : [];
      if (!items.length) return null;
      return (
        <ul key={index}>
          {items.map((item, itemIndex) => <li key={`${index}-${itemIndex}`}>{item}</li>)}
        </ul>
      );
    }
    case "image": {
      const src = safeImageUrl(text(block.src || block.url));
      if (!src) return null;
      return (
        <figure className="learning-content-image" key={index}>
          {/* External lesson images are rendered only for HTTPS URLs and are never interpreted as HTML. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={text(block.alt).slice(0, 250)}
            loading="lazy"
            decoding="async"
          />
          {text(block.caption).trim() && <figcaption>{text(block.caption)}</figcaption>}
        </figure>
      );
    }
    case "note": {
      const note = text(block.text).trim();
      return note ? (
        <aside className="learning-note-card" key={index}>
          <strong>{text(block.title).trim() || "Learning note"}</strong>
          <p>{note}</p>
        </aside>
      ) : null;
    }
    default:
      return null;
  }
}

export function StructuredLessonContent({ content }) {
  const blocks =
    content && typeof content === "object" && Array.isArray(content.blocks)
      ? content.blocks
      : [];
  const rendered = blocks
    .map((block, index) => renderContentBlock(block, index))
    .filter(Boolean);

  return (
    <div className="learning-rich-content">
      {rendered.length ? (
        rendered
      ) : (
        <p className="learning-empty-message">
          Structured reading content has not been added to this lesson yet.
        </p>
      )}
    </div>
  );
}

function fileSizeLabel(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) < 1) return null;
  const size = Number(bytes);
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function resourceIcon(type) {
  if (type === "DOCUMENT") return FileText;
  if (type === "AUDIO") return Headphones;
  if (type === "VIDEO") return Video;
  return Link2;
}

export function LessonResources({ resources }) {
  if (!resources?.length) return null;
  return (
    <section className="learning-resources student-panel" aria-labelledby="learning-resources-title">
      <header className="student-panel-heading">
        <div>
          <p className="student-eyebrow">Keep for later</p>
          <h2 id="learning-resources-title">Lesson resources</h2>
        </div>
        <FileText size={19} aria-hidden="true" />
      </header>
      <ul>
        {resources.map((resource) => {
          const Icon = resourceIcon(resource.type);
          return (
            <li key={resource.id}>
              <span className="learning-resource-icon">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="learning-resource-copy">
                <strong>{resource.title}</strong>
                <span>
                  {resource.type.toLowerCase()}
                  {fileSizeLabel(resource.size) && ` · ${fileSizeLabel(resource.size)}`}
                </span>
              </span>
              {resource.url ? (
                <a
                  className="learning-resource-action"
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {resource.type === "LINK" ? "Open" : "Download"}
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
              ) : (
                <span className="learning-resource-unavailable" role="status">
                  Unavailable
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {resources.some((resource) => resource.unavailable) && (
        <p className="learning-resource-warning" role="status">
          One or more private files could not be authorized. Refresh the lesson or try again later.
        </p>
      )}
    </section>
  );
}

export function LessonLearningWorkspace({ data }) {
  const lesson = data.selectedLesson;
  const progress = lesson.progress;
  const percent = data.lessons.length
    ? Math.round((data.completedLessons / data.lessons.length) * 100)
    : 0;

  return (
    <div className="student-page learning-page">
      <LearningBreadcrumb course={data.course} currentLesson={lesson} />
      <header className="learning-topline student-panel">
        <div>
          <p className="student-eyebrow">{data.course.title}</p>
          <h1>{lesson.title}</h1>
        </div>
        <div className="learning-topline-progress">
          <Progress
            value={percent}
            label={`${data.completedLessons} of ${data.lessons.length} lessons complete`}
            showValue
          />
          <Link href="/student/courses">
            <ArrowLeft size={15} aria-hidden="true" /> My courses
          </Link>
        </div>
      </header>

      <div className="learning-workspace-grid">
        <main className="learning-main-column">
          <section className="learning-lesson-heading">
            <div className="learning-lesson-meta">
              <span><LessonTypeIcon type={lesson.content_type} /> {lessonTypeLabel(lesson.content_type)}</span>
              {durationLabel(lesson.duration_seconds) && (
                <span><Clock3 size={14} aria-hidden="true" /> {durationLabel(lesson.duration_seconds)}</span>
              )}
              {progress?.status === "COMPLETED" && (
                <span className="learning-completed-badge"><Check size={14} aria-hidden="true" /> Completed</span>
              )}
            </div>
            <h2>{lesson.title}</h2>
            {lesson.description && <p>{lesson.description}</p>}
          </section>

          <LessonPlayer
            key={lesson.id}
            lessonId={lesson.id}
            contentType={lesson.content_type}
            media={lesson.media}
            initialPosition={progress?.last_position_seconds || 0}
            duration={lesson.duration_seconds}
            completed={progress?.status === "COMPLETED"}
          />

          {["TEXT", "MIXED"].includes(lesson.content_type) && (
            <section className="learning-content-panel student-panel">
              <header className="student-panel-heading">
                <div>
                  <p className="student-eyebrow">Learn at your own pace</p>
                  <h2>Lesson notes</h2>
                </div>
                <BookOpen size={19} aria-hidden="true" />
              </header>
              <StructuredLessonContent content={lesson.content} />
            </section>
          )}

          <LessonResources resources={data.resources} />
          <LearningAssessments
            assessments={data.assessments}
            lessonId={lesson.id}
          />

          <nav className="learning-lesson-navigation" aria-label="Lesson navigation">
            {data.previousLesson ? (
              <Link href={routeForLesson(data.course.id, data.previousLesson.id)}>
                <ArrowLeft size={16} aria-hidden="true" />
                <span><small>Previous lesson</small><strong>{data.previousLesson.title}</strong></span>
              </Link>
            ) : (
              <span className="learning-navigation-disabled" aria-disabled="true">
                <ArrowLeft size={16} aria-hidden="true" />
                <span><small>Previous lesson</small><strong>Course start</strong></span>
              </span>
            )}
            {data.nextLesson ? (
              <Link href={routeForLesson(data.course.id, data.nextLesson.id)}>
                <span><small>Next lesson</small><strong>{data.nextLesson.title}</strong></span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <span className="learning-navigation-disabled is-last" aria-disabled="true">
                <span><small>Next lesson</small><strong>Course end</strong></span>
              </span>
            )}
          </nav>
        </main>

        <aside className="learning-curriculum-panel student-panel">
          <header className="student-panel-heading">
            <div>
              <p className="student-eyebrow">Your learning path</p>
              <h2>Course content</h2>
            </div>
            <span>{data.completedLessons}/{data.lessons.length}</span>
          </header>
          <LearningCurriculum
            courseId={data.course.id}
            sections={data.sections}
            assessments={data.assessments}
            currentLessonId={lesson.id}
          />
        </aside>
      </div>
    </div>
  );
}
