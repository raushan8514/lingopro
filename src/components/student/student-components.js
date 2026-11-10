import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Play,
  Sparkles,
} from "lucide-react";
import { Avatar, Progress } from "@/components/ui/indicators";
import { EmptyState } from "@/components/ui/feedback";
import { addCalendarDays, getLocalDateKey } from "@/lib/student/time";

const activityPresentation = {
  COURSE_ENROLLED: { Icon: BookOpen, label: "Course enrollment" },
  LESSON_STARTED: { Icon: Play, label: "Lesson started" },
  LESSON_COMPLETED: { Icon: CheckCircle2, label: "Lesson completed" },
  QUIZ_ATTEMPTED: { Icon: ClipboardCheck, label: "Quiz submitted" },
  QUIZ_PASSED: { Icon: Award, label: "Quiz passed" },
  CERTIFICATE_EARNED: { Icon: GraduationCap, label: "Certificate earned" },
};

export function StudentPageHeader({
  eyebrow,
  title,
  description,
  action,
  className = "",
}) {
  return (
    <header className={`student-page-heading ${className}`.trim()}>
      <div>
        {eyebrow && <p className="student-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="student-page-description">{description}</p>}
      </div>
      {action && <div className="student-page-heading-action">{action}</div>}
    </header>
  );
}

export function StudentStatCard({ Icon, label, value, detail, tone = "green" }) {
  return (
    <article className={`student-stat-card tone-${tone}`}>
      <span className="student-stat-icon">
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="student-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  );
}

export function StudentCourseCard({ course, compact = false }) {
  const learningPath = `/student/courses/${course.id}/learn`;
  const resumeHref = course.resumeLessonId
    ? `${learningPath}/${course.resumeLessonId}`
    : learningPath;

  return (
    <article className={`student-course-card${compact ? " is-compact" : ""}`}>
      <Link
        className="student-course-art"
        href={learningPath}
        aria-label={`Open ${course.title} learning workspace`}
      >
        {course.thumbnailUrl ? (
          // Course artwork is a database-validated HTTP(S) URL; dimensions are fixed by the card.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="student-course-art-fallback" aria-hidden="true">
            <BookOpen size={29} strokeWidth={1.6} />
          </span>
        )}
      </Link>
      <div className="student-course-body">
        <div className="student-course-card-heading">
          <span className={`student-course-status status-${course.status.toLowerCase()}`}>
            {course.status === "COMPLETED" ? "Completed" : "In progress"}
          </span>
          <Link href={learningPath} className="student-course-title">
            {course.title}
          </Link>
          <span className="student-course-instructor">
            <Avatar
              name={course.instructorName}
              src={course.instructorAvatar}
              size="sm"
            />
            <span>{course.instructorName}</span>
          </span>
        </div>
        <div className="student-course-progress">
          {course.totalLessons > 0 ? (
            <Progress
              value={course.progressPercent}
              label={`${course.completedLessons} of ${course.totalLessons} lessons`}
              showValue
            />
          ) : (
            <p className="student-course-no-lessons">
              No published lessons are available yet.
            </p>
          )}
        </div>
        <div className="student-course-card-footer">
          <span>
            {course.lastLessonTitle
              ? `Last active: ${course.lastLessonTitle}`
              : course.totalLessons
                ? "Ready when you are"
                : "Course details"}
          </span>
          <Link href={resumeHref}>
            {course.status === "COMPLETED"
              ? "Review course"
              : course.resumeLessonId
                ? "Continue"
                : course.totalLessons
                  ? "Start learning"
                  : "Open course"}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function activityDateLabel(timestamp, timeZone, now) {
  const date = new Date(timestamp);
  const key = getLocalDateKey(date, timeZone);
  const todayKey = getLocalDateKey(now, timeZone);
  const yesterdayKey = addCalendarDays(todayKey, -1);

  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone,
  }).format(date);
}

export function StudentActivityList({
  activities = [],
  timeZone = "UTC",
  emptyTitle = "Your learning activity will appear here",
  emptyDescription = "Complete a lesson or submit a quiz to begin your activity history.",
}) {
  if (!activities.length) {
    return (
      <EmptyState
        icon={Sparkles}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  const now = new Date();
  const groups = new Map();
  for (const activity of activities) {
    const label = activityDateLabel(activity.occurred_at, timeZone, now);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(activity);
  }

  return (
    <div className="student-activity-groups">
      {[...groups.entries()].map(([date, items]) => (
        <section className="student-activity-group" key={date}>
          <h3>{date}</h3>
          <ol className="student-activity-list">
            {items.map((activity) => {
              const { Icon, label } =
                activityPresentation[activity.activity_type] || {
                  Icon: Clock3,
                  label: "Learning activity",
                };
              const content = (
                <>
                  <span className="student-activity-icon">
                    <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="student-activity-copy">
                    <strong>{activity.title}</strong>
                    <span>{activity.description}</span>
                  </span>
                  <time dateTime={activity.occurred_at}>
                    {new Intl.DateTimeFormat("en", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone,
                    }).format(new Date(activity.occurred_at))}
                  </time>
                </>
              );

              return (
                <li key={activity.activity_id}>
                  {activity.target_url?.startsWith("/") &&
                  !activity.target_url.startsWith("//") ? (
                    <Link href={activity.target_url} aria-label={`${label}: ${activity.title}`}>
                      {content}
                    </Link>
                  ) : (
                    <div className="student-activity-row">{content}</div>
                  )}
                  <span className="student-sr-only">{label}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function StudentCourseEmptyState({ action }) {
  return (
    <EmptyState
      icon={BookOpen}
      title="Your course library is ready"
      description="Courses you enroll in will show up here with real lesson progress and recent activity."
      action={action}
    />
  );
}

export function StudentAchievementEmptyState() {
  return (
    <EmptyState
      icon={Award}
      title="Achievements are earned, not assigned"
      description="Certificates and completed courses will appear here after the required learning is recorded."
    />
  );
}

export function StudentNoCoursesMessage() {
  return (
    <EmptyState
      icon={GraduationCap}
      title="No enrolled courses yet"
      description="Explore the published catalog when you are ready to choose a course."
      action={
        <Link className="ui-button ui-button-primary ui-button-md" href="/courses">
          Explore courses <ArrowRight size={16} aria-hidden="true" />
        </Link>
      }
    />
  );
}
