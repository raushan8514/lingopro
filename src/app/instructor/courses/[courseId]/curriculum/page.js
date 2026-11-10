import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus } from "lucide-react";
import {
  InstructorDeleteForm,
  InstructorLessonForm,
  InstructorResourceForm,
  InstructorReorderButtons,
  InstructorSectionForm,
} from "@/components/instructor/instructor-forms";
import { deleteInstructorLesson, deleteInstructorResource, deleteInstructorSection } from "@/app/instructor/actions";
import {
  InstructorEmptyState,
  InstructorPageHeader,
  InstructorPanel,
  InstructorStatus,
} from "@/components/instructor/instructor-components";
import { getInstructorCourse } from "@/lib/instructor/data";

export const metadata = {
  title: "Course curriculum",
  robots: { index: false, follow: false },
};

export default async function InstructorCurriculumPage({ params }) {
  const { courseId } = await params;
  const { course, sections } = await getInstructorCourse(courseId, {
    includeAssessments: false,
    includeAnswerKeys: false,
    includeAttempts: false,
    includeCategories: false,
    includeProgress: false,
    includeResponses: false,
    includeRoster: false,
  });
  const editable = ["DRAFT", "PENDING_REVIEW"].includes(course.status);

  return (
    <div className="student-page instructor-page">
      <Link className="instructor-back-link" href={`/instructor/courses/${courseId}`}><ArrowLeft size={15} /> Back to course</Link>
      <InstructorPageHeader
        eyebrow={course.title}
        title="Course curriculum"
        description="Organize sections, lessons, learning materials, and preview access."
      />
      {!editable && (
        <p className="instructor-notice">
          This course is {course.status.toLowerCase()}. Its curriculum is read-only; administrators manage course publication.
        </p>
      )}
      {editable && (
        <InstructorPanel title="Add a section" eyebrow="Curriculum structure">
          <InstructorSectionForm courseId={courseId} />
        </InstructorPanel>
      )}
      {sections.length ? (
        <div className="instructor-section-list">
          {sections.map((section) => (
            <InstructorPanel
              key={section.id}
              eyebrow={`Section ${section.position + 1}`}
              title={section.title}
              action={editable ? (
                <InstructorReorderButtons
                  courseId={courseId}
                  items={sections}
                  itemId={section.id}
                />
              ) : null}
              className="instructor-section-panel"
            >
              <p className="instructor-section-description">{section.description || "No section description."}</p>
              {editable && (
                <details className="instructor-edit-details">
                  <summary>Edit section details</summary>
                  <InstructorSectionForm courseId={courseId} section={section} />
                </details>
              )}
              {editable && (
                <InstructorDeleteForm
                  action={deleteInstructorSection}
                  fields={{ course_id: courseId, section_id: section.id }}
                  label="Delete empty section"
                />
              )}
              <div className="instructor-lesson-list">
                {section.lessons.map((lesson) => (
                  <article className="instructor-lesson-item" key={lesson.id}>
                    <div className="instructor-lesson-item-heading">
                      {editable && (
                        <InstructorReorderButtons
                          courseId={courseId}
                          sectionId={section.id}
                          items={section.lessons}
                          itemId={lesson.id}
                        />
                      )}
                      <div>
                        <strong>{lesson.title}</strong>
                        <span>{lesson.content_type.toLowerCase()} · {lesson.duration_seconds ? `${Math.ceil(lesson.duration_seconds / 60)} min` : "duration not set"}</span>
                      </div>
                      <InstructorStatus status={lesson.is_published ? "PUBLISHED" : "DRAFT"} />
                    </div>
                    {editable && (
                      <details className="instructor-edit-details">
                        <summary>Edit lesson</summary>
                        <InstructorLessonForm courseId={courseId} sectionId={section.id} lesson={lesson} />
                      </details>
                    )}
                    {lesson.resources?.length > 0 && (
                      <ul className="instructor-resource-list">
                        {lesson.resources.map((resource) => (
                          <li key={resource.id}>
                            <span>{resource.title} <small>{resource.resource_type.toLowerCase()}</small></span>
                            {resource.external_url && (
                              <a href={resource.external_url} target="_blank" rel="noreferrer">
                                Open link <ExternalLink size={13} aria-hidden="true" />
                              </a>
                            )}
                            {editable && resource.external_url && (
                              <InstructorDeleteForm
                                action={deleteInstructorResource}
                                fields={{ course_id: courseId, lesson_id: lesson.id, resource_id: resource.id }}
                                label="Remove"
                              />
                            )}
                            {editable && !resource.external_url && (
                              <small>Private file resource — preserved; storage uploads and removal are not enabled here.</small>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {editable && (
                      <details className="instructor-edit-details">
                        <summary>Add learning resource</summary>
                        <InstructorResourceForm courseId={courseId} lessonId={lesson.id} />
                      </details>
                    )}
                    {editable && (
                      <InstructorDeleteForm
                        action={deleteInstructorLesson}
                        fields={{ course_id: courseId, section_id: section.id, lesson_id: lesson.id }}
                        label="Delete lesson"
                      />
                    )}
                  </article>
                ))}
                {!section.lessons.length && (
                  <InstructorEmptyState title="No lessons in this section" description="Add a lesson to start building the learning experience." />
                )}
              </div>
              {editable && (
                <details className="instructor-add-lesson">
                  <summary><Plus size={16} /> Add lesson</summary>
                  <InstructorLessonForm courseId={courseId} sectionId={section.id} />
                </details>
              )}
            </InstructorPanel>
          ))}
        </div>
      ) : (
        <InstructorPanel>
          <InstructorEmptyState title="No sections yet" description="Create a section to organize your lessons." />
        </InstructorPanel>
      )}
    </div>
  );
}
