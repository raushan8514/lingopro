import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  PlayCircle,
  UserRound,
} from "lucide-react";
import { Alert, Badge, Breadcrumb, EmptyState } from "@/components/ui";
import EnrollmentAction from "@/components/courses/enrollment-action";
import CourseThumbnail from "@/components/courses/course-thumbnail";
import InstructorAvatar from "@/components/courses/instructor-avatar";
import CourseLoading from "@/components/courses/course-loading";
import {
  getCourseEnrollment,
  getPublicCourseCurriculum,
  getPublicInstructorProfile,
  getPublishedCourseBySlug,
} from "@/lib/courses/data";
import { getAuthContext } from "@/lib/auth/server";

const difficultyLabels = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

function formatPrice(cents, currency) {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDuration(minutes) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const extraMinutes = minutes % 60;
  if (!hours) return `${extraMinutes} minutes`;
  if (!extraMinutes) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${hours} hr ${extraMinutes} min`;
}

function CourseLoadingError({ configured }) {
  return (
    <div className="market-catalog-state">
      <Alert
        variant={configured ? "error" : "warning"}
        title={configured ? "Course details are unavailable" : "Course catalog not connected"}
      >
        {configured
          ? "We couldn't load current course information. Please try again shortly."
          : "Connect Supabase and apply the database migrations to browse course details."}
      </Alert>
    </div>
  );
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const result = await getPublishedCourseBySlug(slug);
  const course = result.course;

  return {
    title: course?.title || "Language course",
    description:
      course?.short_description ||
      `Explore the ${course?.title || "language course"} curriculum on LingoPro.`,
    alternates: { canonical: `/courses/${encodeURIComponent(slug)}` },
    openGraph: course?.thumbnail_url
      ? { images: [{ url: course.thumbnail_url, alt: course.title }] }
      : undefined,
  };
}

export default function CourseDetailPage({ params }) {
  return (
    <Suspense fallback={<CourseLoading />}>
      <CourseDetailContent params={params} />
    </Suspense>
  );
}

async function CourseDetailContent({ params }) {
  await connection();
  const { slug } = await params;
  const courseResult = await getPublishedCourseBySlug(slug);

  if (courseResult.status === "ready" && !courseResult.course) notFound();

  if (courseResult.status !== "ready") {
    return (
      <main id="main-content" className="market-page">
        <CourseLoadingError configured={courseResult.status !== "unconfigured"} />
      </main>
    );
  }

  const course = courseResult.course;
  const [curriculumResult, auth, instructorResult] = await Promise.all([
    getPublicCourseCurriculum(course.id),
    getAuthContext(),
    getPublicInstructorProfile(course.instructor_id),
  ]);
  const instructor = instructorResult.instructor;
  const enrollmentResult =
    auth.status === "authenticated" && auth.role === "student"
      ? await getCourseEnrollment(course.id, auth.user.id)
      : { status: "ready", enrollment: null };
  const duration = formatDuration(course.estimated_duration_minutes);
  const sections = curriculumResult.status === "ready"
    ? curriculumResult.sections
    : [];
  const lessonCount = sections.reduce(
    (total, section) => total + (section.lessons?.length || 0),
    0,
  );

  return (
    <main id="main-content" className="market-page market-detail-page">
      <Breadcrumb
        items={[
          { label: "Courses", href: "/courses" },
          ...(course.category
            ? [{
                label: course.category.name,
                href: `/categories/${encodeURIComponent(course.category.slug)}`,
              }]
            : []),
          { label: course.title },
        ]}
        label="Course navigation"
      />

      <section className="market-detail-hero">
        <div className="market-detail-copy">
          <div className="market-course-card-labels">
            <Badge variant="neutral">{course.language}</Badge>
            <Badge variant="information">
              {difficultyLabels[course.difficulty] || "Course"}
            </Badge>
            {course.category?.name && <Badge variant="success">{course.category.name}</Badge>}
          </div>
          <h1>{course.title}</h1>
          {course.short_description && (
            <p className="market-detail-lead">{course.short_description}</p>
          )}
          <div className="market-detail-instructor">
            <InstructorAvatar
              name={instructor?.full_name || "LingoPro instructor"}
              src={instructor?.avatar_url || undefined}
              size="sm"
            />
            <span>
              <span className="market-detail-instructor-label">Created by</span>
              {instructor ? (
                <Link href={`/instructors/${encodeURIComponent(instructor.id)}`}>
                  {instructor.full_name}
                </Link>
              ) : (
                <span>LingoPro instructor</span>
              )}
            </span>
          </div>
          <div className="market-detail-quick-facts">
            {duration && (
              <span><Clock3 size={16} aria-hidden="true" />{duration} estimated</span>
            )}
            <span><BookOpen size={16} aria-hidden="true" />{lessonCount} published lessons</span>
          </div>
        </div>
        <aside className="market-enrollment-card" id="enrollment">
          <div className="market-detail-cover">
            <CourseThumbnail
              src={course.thumbnail_url}
              variant="detail"
              priority
            />
          </div>
          <div className="market-enrollment-card-content">
            <div className="market-detail-price">
              <span>Course access</span>
              <strong>{formatPrice(course.price_cents, course.currency)}</strong>
            </div>
            <EnrollmentAction
              course={course}
              authStatus={auth.status}
              role={auth.role}
              enrollment={enrollmentResult.enrollment}
              enrollmentStatus={enrollmentResult.status}
            />
            <p className="market-enrollment-footnote">
              <CheckCircle2 size={14} aria-hidden="true" />
              {course.price_cents === 0
                ? "No payment is required to enroll."
                : "One-time purchase; access follows provider-verified payment."}
            </p>
          </div>
        </aside>
      </section>

      <section className="market-detail-body">
        <div className="market-detail-main">
          <section className="market-overview-section">
            <span className="market-section-kicker">Course overview</span>
            <h2>Make progress, one useful phrase at a time.</h2>
            {course.description ? (
              <p className="market-course-description">{course.description}</p>
            ) : (
              <p className="market-course-description">
                {course.short_description || "Course details will be added by the instructor."}
              </p>
            )}
            {course.learning_outcomes?.length > 0 && (
              <div className="market-course-outcomes">
                <h3>What you’ll learn</h3>
                <ul>
                  {course.learning_outcomes.map((outcome) => (
                    <li key={outcome}>{outcome}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="market-course-audience-grid">
              {course.prerequisites && (
                <section>
                  <h3>Prerequisites</h3>
                  <p>{course.prerequisites}</p>
                </section>
              )}
              {course.target_audience && (
                <section>
                  <h3>Who this course is for</h3>
                  <p>{course.target_audience}</p>
                </section>
              )}
            </div>
          </section>

          <section className="market-curriculum-section">
            <div className="market-curriculum-heading">
              <div>
                <span className="market-section-kicker">The learning path</span>
                <h2>Course curriculum</h2>
              </div>
              <span>{sections.length} {sections.length === 1 ? "section" : "sections"}</span>
            </div>
            {curriculumResult.status !== "ready" ? (
              <Alert variant="warning" title="Curriculum unavailable">
                Course content details couldn’t be loaded right now. You can still review the course overview.
              </Alert>
            ) : sections.length ? (
              <div className="market-curriculum-list">
                {sections.map((section, index) => (
                  <details className="market-curriculum-section-item" key={section.id} open={index === 0}>
                    <summary>
                      <span className="market-curriculum-section-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="market-curriculum-section-title">{section.title}</span>
                      <span className="market-curriculum-section-count">
                        {section.lessons?.length || 0} lessons
                      </span>
                    </summary>
                    {section.lessons?.length ? (
                      <ul>
                        {section.lessons.map((lesson) => (
                          <li key={lesson.id}>
                            <span className="market-lesson-kind" aria-hidden="true">
                              <PlayCircle size={16} />
                            </span>
                            <span className="market-lesson-title">{lesson.title}</span>
                            {lesson.is_preview && (
                              <Badge variant="success">Preview</Badge>
                            )}
                            {lesson.duration_seconds && (
                              <span className="market-lesson-duration">
                                {Math.ceil(lesson.duration_seconds / 60)} min
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="market-no-lessons">Published lessons will appear here.</p>
                    )}
                  </details>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="Curriculum coming soon"
                description="The instructor hasn’t published the course outline yet."
              />
            )}
          </section>
        </div>
        <aside className="market-detail-aside">
          <div className="market-aside-card">
            <span className="market-aside-icon"><UserRound size={18} aria-hidden="true" /></span>
            <h3>Learn with a real instructor</h3>
            <p>Explore the courses and public profile shared by this LingoPro instructor.</p>
            {instructor && (
              <Link
                className="market-text-action"
                href={`/instructors/${encodeURIComponent(instructor.id)}`}
              >
                View instructor profile <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
          </div>
          <Link className="market-back-link" href="/courses">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to all courses
          </Link>
        </aside>
      </section>
    </main>
  );
}
