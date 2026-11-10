import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck, UsersRound } from "lucide-react";
import {
  InstructorCertificateRequirementsForm,
  InstructorCourseForm,
} from "@/components/instructor/instructor-forms";
import {
  InstructorPageHeader,
  InstructorPanel,
  InstructorStatus,
} from "@/components/instructor/instructor-components";
import { getInstructorCourse } from "@/lib/instructor/data";

export const metadata = {
  title: "Course management",
  robots: { index: false, follow: false },
};

export default async function InstructorCoursePage({ params }) {
  const { courseId } = await params;
  const data = await getInstructorCourse(courseId, {
    includeAnswerKeys: false,
    includeAttempts: false,
    includeProgress: false,
    includeResponses: false,
  });
  const { course } = data;
  const editable = ["DRAFT", "PENDING_REVIEW"].includes(course.status);

  return (
    <div className="student-page instructor-page">
      <InstructorPageHeader
        eyebrow="Course management"
        title={course.title}
        description={course.short_description || "Manage course details, curriculum, enrolled learners, and assessments."}
      />
      <section className="instructor-course-summary">
        <div>
          <InstructorStatus status={course.status} />
          <p>{course.language} · {course.difficulty.toLowerCase()} · Updated {new Date(course.updated_at).toLocaleDateString("en", { dateStyle: "medium" })}</p>
        </div>
        <nav className="instructor-course-shortcuts" aria-label="Course management sections">
          <Link href={`/instructor/courses/${course.id}/curriculum`}><BookOpen size={16} /> Curriculum <ArrowRight size={14} /></Link>
          <Link href={`/instructor/courses/${course.id}/students`}><UsersRound size={16} /> Learners <ArrowRight size={14} /></Link>
          <Link href={`/instructor/courses/${course.id}/assessments`}><ClipboardCheck size={16} /> Assessments <ArrowRight size={14} /></Link>
        </nav>
      </section>

      <InstructorPanel
        eyebrow={editable ? "Draft settings" : "Course details"}
        title={editable ? "Course information" : "Publication is managed by administrators"}
      >
        {editable ? (
          <InstructorCourseForm course={course} categories={data.categories} />
        ) : (
          <div className="instructor-readonly-details">
            <p>This course is {course.status.toLowerCase()}. Its details and curriculum are read-only here; administrators control publication and archiving.</p>
            <dl>
              <div><dt>Course slug</dt><dd>{course.slug}</dd></div>
              <div><dt>Language</dt><dd>{course.language}</dd></div>
              <div><dt>Difficulty</dt><dd>{course.difficulty.toLowerCase()}</dd></div>
              <div><dt>Published on</dt><dd>{course.published_at ? new Date(course.published_at).toLocaleDateString("en", { dateStyle: "medium" }) : "—"}</dd></div>
            </dl>
          </div>
        )}
      </InstructorPanel>

      <InstructorPanel
        eyebrow="Certificate policy"
        title="Completion and assessment requirements"
      >
        <p className="instructor-form-help">
          These rules are checked against persisted lesson progress and graded
          assessment attempts before course completion and certificate issuance.
        </p>
        <InstructorCertificateRequirementsForm
          courseId={course.id}
          requirements={data.certificateRequirements}
        />
      </InstructorPanel>

      <div className="instructor-course-overview-grid">
        <article><span>Sections</span><strong>{data.sections.length}</strong><Link href={`/instructor/courses/${course.id}/curriculum`}>Edit curriculum <ArrowRight size={14} /></Link></article>
        <article><span>Assessments</span><strong>{data.assessments.length}</strong><Link href={`/instructor/courses/${course.id}/assessments`}>Manage assessments <ArrowRight size={14} /></Link></article>
        <article><span>Enrolled learners</span><strong>{data.students.length}</strong><Link href={`/instructor/courses/${course.id}/students`}>View learners <ArrowRight size={14} /></Link></article>
      </div>
    </div>
  );
}
