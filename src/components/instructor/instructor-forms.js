"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, LoaderCircle, Trash2 } from "lucide-react";
import {
  deleteInstructorLesson,
  deleteInstructorQuestion,
  deleteInstructorResource,
  deleteInstructorSection,
  gradeInstructorAnswer,
  importInstructorQuestionBankItem,
  reorderInstructorLessons,
  reorderInstructorQuestions,
  reorderInstructorSections,
  saveInstructorAssessment,
  saveInstructorCertificateRequirements,
  saveInstructorCourse,
  saveInstructorLesson,
  saveInstructorProfile,
  saveInstructorQuestion,
  saveInstructorQuestionToBank,
  saveInstructorResource,
  saveInstructorSection,
  setInstructorAssessmentPublished,
} from "@/app/instructor/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form-controls";
import CourseCoverUploader from "@/components/instructor/course-cover-uploader";

const initialState = { error: "", success: "" };

function ActionMessage({ state }) {
  if (state.error) {
    return (
      <div className="instructor-form-message is-error" role="alert">
        <p>{state.error}</p>
        {state.courseId && (
          <Link href={`/instructor/courses/${state.courseId}`}>
            Continue editing this course
          </Link>
        )}
      </div>
    );
  }
  if (state.success) {
    return (
      <p className="instructor-form-message is-success" role="status">
        {state.success}
        {state.courseId && (
          <>
            {" "}
            <Link href={`/instructor/courses/${state.courseId}`}>Open course</Link>
          </>
        )}
        {state.assessmentId && (
          <>
            {" "}
            <Link href={`/instructor/assessments/${state.assessmentId}`}>Open assessment</Link>
          </>
        )}
      </p>
    );
  }
  return null;
}

export function InstructorCourseForm({ course = null, categories = [] }) {
  const [state, action, pending] = useActionState(saveInstructorCourse, initialState);
  return (
    <form className="instructor-form" action={action}>
      {course && <input type="hidden" name="course_id" value={course.id} />}
      <div className="instructor-form-grid">
        <Input label="Course title" name="title" defaultValue={course?.title || ""} maxLength={180} required />
        <Input label="URL slug" name="slug" defaultValue={course?.slug || ""} maxLength={180} hint="Use lowercase words and hyphens; leave blank to create it from the title." />
        <Input label="Language" name="language" defaultValue={course?.language || ""} maxLength={80} required />
        <Select label="Difficulty" name="difficulty" defaultValue={course?.difficulty || "BEGINNER"} required>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
        </Select>
        <Select label="Category" name="category_id" defaultValue={course?.category_id || ""}>
          <option value="">No category</option>
          {course?.category_id && !categories.some((category) => category.id === course.category_id) && (
            <option value={course.category_id}>Current category (inactive)</option>
          )}
          {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </Select>
        <Input label="Estimated duration (minutes)" name="estimated_duration_minutes" type="number" min="1" defaultValue={course?.estimated_duration_minutes || ""} />
        <Input label="Price (USD cents)" name="price_cents" type="number" min="0" defaultValue={course?.price_cents ?? 0} required hint="Paid course checkout uses the configured Razorpay integration; no charge occurs while editing a draft." />
      </div>
      <Textarea label="Short description" name="short_description" defaultValue={course?.short_description || ""} maxLength={500} rows={3} />
      <Textarea label="Course description" name="description" defaultValue={course?.description || ""} maxLength={20000} rows={7} />
      <Textarea
        label="Learning outcomes"
        name="learning_outcomes"
        defaultValue={(course?.learning_outcomes || []).join("\n")}
        maxLength={6200}
        rows={5}
        hint="Add one clear outcome per line, up to 20."
      />
      <Textarea
        label="Prerequisites"
        name="prerequisites"
        defaultValue={course?.prerequisites || ""}
        maxLength={5000}
        rows={3}
        hint="Describe any prior knowledge or materials learners should have."
      />
      <Textarea
        label="Target audience"
        name="target_audience"
        defaultValue={course?.target_audience || ""}
        maxLength={5000}
        rows={3}
        hint="Describe who will benefit most from this course."
      />
      {course && (
        <p className="instructor-form-help">
          Status: <strong>{course.status.replaceAll("_", " ")}</strong>. Only administrators can publish or archive courses.
        </p>
      )}
      {course ? (
        <CourseCoverUploader courseId={course.id} currentUrl={course.thumbnail_url} />
      ) : (
        <p className="instructor-form-help">
          Save the draft first to securely upload its cover image.
        </p>
      )}
      <ActionMessage state={state} />
      <div className="instructor-form-actions">
        <Button type="submit" name="intent" value="save" loading={pending} leftIcon={<Check size={16} aria-hidden="true" />}>
          Save draft
        </Button>
        {course?.status === "DRAFT" && (
          <Button type="submit" name="intent" value="submit" variant="outline" disabled={pending}>
            Submit for review
          </Button>
        )}
      </div>
    </form>
  );
}

export function InstructorSectionForm({ courseId, section = null }) {
  const [state, action, pending] = useActionState(saveInstructorSection, initialState);
  return (
    <form action={action} className="instructor-inline-form">
      <input type="hidden" name="course_id" value={courseId} />
      {section && <input type="hidden" name="section_id" value={section.id} />}
      <Input label="Section title" name="title" defaultValue={section?.title || ""} maxLength={180} required />
      <Textarea label="Section description" name="description" defaultValue={section?.description || ""} maxLength={4000} rows={2} />
      <ActionMessage state={state} />
      <Button type="submit" loading={pending}>{section ? "Save section" : "Add section"}</Button>
    </form>
  );
}

export function InstructorLessonForm({ courseId, sectionId, lesson = null }) {
  const [state, action, pending] = useActionState(saveInstructorLesson, initialState);
  const defaultContent = lesson?.content ? JSON.stringify(lesson.content, null, 2) : "";
  return (
    <form action={action} className="instructor-form instructor-lesson-form">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="section_id" value={sectionId} />
      {lesson && <input type="hidden" name="lesson_id" value={lesson.id} />}
      <div className="instructor-form-grid">
        <Input label="Lesson title" name="title" defaultValue={lesson?.title || ""} maxLength={180} required />
        <Select label="Lesson type" name="content_type" defaultValue={lesson?.content_type || "TEXT"} required>
          <option value="VIDEO">Video</option>
          <option value="AUDIO">Audio</option>
          <option value="TEXT">Text</option>
          <option value="MIXED">Mixed</option>
        </Select>
        <Input label="Duration (seconds)" name="duration_seconds" type="number" min="1" max="86400" defaultValue={lesson?.duration_seconds || ""} />
        <Input label="Video URL (HTTPS)" name="video_url" type="url" defaultValue={lesson?.video_url || ""} placeholder="https://…/video.mp4 or YouTube link" />
        <Input label="Audio URL (HTTPS)" name="audio_url" type="url" defaultValue={lesson?.audio_url || ""} placeholder="https://…/audio.mp3" />
      </div>
      <Textarea label="Lesson description" name="description" defaultValue={lesson?.description || ""} maxLength={4000} rows={2} />
      <Textarea
        label="Structured text content (JSON)"
        name="content_json"
        defaultValue={defaultContent}
        rows={8}
        hint='Use a JSON object with a "blocks" array. Supported blocks include heading, paragraph, vocabulary, grammar, example, list, image, and note. Content is rendered as text, never raw HTML.'
      />
      <div className="instructor-form-checks">
        <Checkbox label="Publish lesson to enrolled students" name="is_published" defaultChecked={lesson?.is_published || false} />
        <Checkbox label="Allow preview access" name="is_preview" defaultChecked={lesson?.is_preview || false} />
      </div>
      {lesson?.video_storage_path || lesson?.audio_storage_path ? (
        <p className="instructor-form-help">This lesson has a private uploaded media source. Saving the form preserves its storage path; use the configured Supabase project to manage the file.</p>
      ) : (
        <p className="instructor-form-help">This editor supports secure external HTTPS sources. It does not upload or transcode video/audio files.</p>
      )}
      <ActionMessage state={state} />
      <Button type="submit" loading={pending}>{lesson ? "Save lesson" : "Add lesson"}</Button>
    </form>
  );
}

export function InstructorResourceForm({ courseId, lessonId }) {
  const [state, action, pending] = useActionState(saveInstructorResource, initialState);
  return (
    <form className="instructor-inline-form" action={action}>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      <Input label="Resource title" name="title" maxLength={180} required />
      <Select label="Resource type" name="resource_type" defaultValue="LINK" required>
        {["DOCUMENT", "AUDIO", "VIDEO", "LINK", "OTHER"].map((type) => <option value={type} key={type}>{type[0] + type.slice(1).toLowerCase()}</option>)}
      </Select>
      <Input label="External HTTPS link" name="external_url" type="url" required placeholder="https://…" />
      <p className="instructor-form-help">Private file uploads are not enabled in this workspace; links are stored as HTTPS-only resources.</p>
      <ActionMessage state={state} />
      <Button type="submit" loading={pending}>Add resource</Button>
    </form>
  );
}

export function InstructorAssessmentForm({
  courseId,
  sections,
  assessment = null,
}) {
  const [state, action, pending] = useActionState(saveInstructorAssessment, initialState);
  const lessons = sections.flatMap((section) =>
    section.lessons.map((lesson) => ({ ...lesson, sectionTitle: section.title })),
  );
  return (
    <form action={action} className="instructor-form">
      <input type="hidden" name="course_id" value={courseId} />
      {assessment && <input type="hidden" name="assessment_id" value={assessment.id} />}
      <div className="instructor-form-grid">
        <Input label="Assessment title" name="title" defaultValue={assessment?.title || ""} maxLength={180} required />
        <Select label="Type" name="assessment_type" defaultValue={assessment?.assessment_type || "PRACTICE"}>
          <option value="PRACTICE">Practice</option>
          <option value="EXAM">Examination</option>
        </Select>
        <Select label="Course placement" name="assessment_scope" defaultValue={assessment?.assessment_scope || (assessment?.lesson_id ? "LESSON_CHECKPOINT" : "COURSE")}>
          <option value="COURSE">Course-wide assessment</option>
          <option value="LESSON_CHECKPOINT">Lesson checkpoint</option>
          <option value="MODULE">Module assessment</option>
          <option value="FINAL">Final examination</option>
        </Select>
        <Select label="Associated lesson (optional)" name="lesson_id" defaultValue={assessment?.lesson_id || ""}>
          <option value="">Course-wide</option>
          {lessons.map((lesson) => <option value={lesson.id} key={lesson.id}>{lesson.sectionTitle} · {lesson.title}</option>)}
        </Select>
        <Select label="Associated module (module assessments only)" name="section_id" defaultValue={assessment?.section_id || ""}>
          <option value="">No module</option>
          {sections.map((section) => <option value={section.id} key={section.id}>{section.title}</option>)}
        </Select>
        <Input label="Time limit (seconds)" name="time_limit_seconds" type="number" min="1" max="86400" defaultValue={assessment?.time_limit_seconds || ""} />
        <Input label="Passing score (%)" name="passing_score" type="number" min="0" max="100" step="0.01" defaultValue={assessment?.passing_score ?? ""} />
        <Input label="Maximum attempts" name="maximum_attempts" type="number" min="1" max="100" defaultValue={assessment?.maximum_attempts || ""} />
        <Input label="Penalty per incorrect question (points)" name="negative_marking" type="number" min="0" step="0.01" defaultValue={assessment?.negative_marking ?? 0} />
        <Input label="Available from" name="available_from" type="datetime-local" defaultValue={assessment?.available_from?.slice(0, 16) || ""} />
        <Input label="Available until" name="available_until" type="datetime-local" defaultValue={assessment?.available_until?.slice(0, 16) || ""} />
      </div>
      <Textarea label="Description" name="description" defaultValue={assessment?.description || ""} maxLength={5000} rows={3} />
      <Textarea label="Instructions" name="instructions" defaultValue={assessment?.instructions || ""} maxLength={10000} rows={4} />
      <div className="instructor-form-checks">
        <Checkbox label="Required for course completion" name="is_required" defaultChecked={assessment?.is_required || false} />
        <Checkbox label="Required for certificate eligibility" name="required_for_certificate" defaultChecked={assessment?.required_for_certificate || false} />
        <Checkbox label="Randomize question order" name="randomize_questions" defaultChecked={assessment?.randomize_questions || false} />
        <Checkbox label="Randomize option order" name="randomize_options" defaultChecked={assessment?.randomize_options || false} />
        <Checkbox label="Allow partial credit on multiple-select questions" name="allow_partial_credit" defaultChecked={assessment?.allow_partial_credit || false} />
        <Checkbox label="Allow learners to review results" name="allow_result_review" defaultChecked={assessment?.allow_result_review ?? true} />
        <Checkbox label="Show correct choices after submission" name="show_correct_answers" defaultChecked={assessment?.show_correct_answers || false} />
        <Checkbox label="Show explanations after submission" name="show_explanations" defaultChecked={assessment?.show_explanations || false} />
      </div>
      {assessment?.is_published && (
        <p className="instructor-form-help">Changing scoring or question settings is blocked by the database after any attempt has started.</p>
      )}
      <ActionMessage state={state} />
      <Button type="submit" loading={pending}>Save assessment settings</Button>
    </form>
  );
}

export function InstructorCertificateRequirementsForm({
  courseId,
  requirements,
}) {
  const [state, action, pending] = useActionState(
    saveInstructorCertificateRequirements,
    initialState,
  );
  return (
    <form action={action} className="instructor-form">
      <input type="hidden" name="course_id" value={courseId} />
      <div className="instructor-form-grid">
        <Input
          label="Required lesson completion (%)"
          name="required_lesson_completion_percent"
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue={requirements.required_lesson_completion_percent}
          required
        />
        <Input
          label="Minimum final exam score (%)"
          name="minimum_final_exam_score"
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue={requirements.minimum_final_exam_score}
          required
        />
      </div>
      <div className="instructor-form-checks">
        <Checkbox
          label="Require all designated assessments and assessments with a passing score"
          name="require_required_assessments"
          defaultChecked={requirements.require_required_assessments}
        />
        <Checkbox
          label="Require a passing final examination"
          name="require_final_exam"
          defaultChecked={requirements.require_final_exam}
        />
      </div>
      <ActionMessage state={state} />
      <Button type="submit" loading={pending}>Save certificate requirements</Button>
    </form>
  );
}

export function InstructorQuestionForm({ courseId, assessmentId, question = null }) {
  const [state, action, pending] = useActionState(saveInstructorQuestion, initialState);
  const [questionType, setQuestionType] = useState(question?.question_type || "SINGLE_CHOICE");
  const trueFalseAnswer = question
    ? question.options.find((option) => option.is_correct)?.option_text?.toUpperCase() || "TRUE"
    : "TRUE";
  return (
    <form action={action} className="instructor-form instructor-question-form">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="assessment_id" value={assessmentId} />
      {question && <>
        <input type="hidden" name="question_id" value={question.id} />
        <input type="hidden" name="position" value={question.position} />
      </>}
      <Textarea label="Question prompt" name="question_text" defaultValue={question?.question_text || ""} maxLength={10000} rows={3} required />
      <div className="instructor-form-grid">
        <Select
          label="Question type"
          name="question_type"
          value={questionType}
          onChange={(event) => setQuestionType(event.target.value)}
        >
          <option value="SINGLE_CHOICE">Single choice</option>
          <option value="MULTIPLE_SELECT">Multiple select</option>
          <option value="TRUE_FALSE">True / false</option>
          <option value="FILL_IN_THE_BLANK">Fill in the blank</option>
          <option value="SHORT_ANSWER">Short answer (manual review)</option>
          <option value="LONG_ANSWER">Long answer (manual review)</option>
          <option value="MATCHING">Matching</option>
        </Select>
        <Input label="Points" name="points" type="number" min="0.01" step="0.01" defaultValue={question?.points || 1} required />
      </div>
      <Select label="Difficulty" name="difficulty" defaultValue={question?.difficulty || ""}>
        <option value="">Not specified</option>
        <option value="EASY">Easy</option>
        <option value="MEDIUM">Medium</option>
        <option value="HARD">Hard</option>
      </Select>
      {questionType === "TRUE_FALSE" ? (
        <Select label="Correct answer" name="true_false_answer" defaultValue={trueFalseAnswer}>
          <option value="TRUE">True</option>
          <option value="FALSE">False</option>
        </Select>
      ) : ["SINGLE_CHOICE", "MULTIPLE_SELECT"].includes(questionType) ? (
        <Textarea
          label="Options (choice questions only)"
          name="options"
          defaultValue={question?.options?.map((option) => `${option.is_correct ? "* " : ""}${option.option_text}`).join("\n") || ""}
          rows={5}
          hint="Enter one option per line. Start correct choices with *; single choice requires exactly one."
        />
      ) : null}
      {questionType === "FILL_IN_THE_BLANK" && (
        <Textarea label="Accepted answers" name="accepted_answers" defaultValue={question?.accepted_answers?.join("\n") || question?.answer_key || ""} rows={3} hint="One accepted response per line. Leave empty only when manual grading is enabled." />
      )}
      {questionType === "MATCHING" && (
        <Textarea
          label="Matching pairs"
          name="matching_pairs"
          defaultValue={question?.matching_pairs?.map((pair) => `${pair.prompt} => ${pair.answer}`).join("\n") || ""}
          rows={6}
          hint="Enter one unique pair per line as prompt => answer. Add 2–20 pairs."
        />
      )}
      {questionType === "LONG_ANSWER" && (
        <p className="instructor-form-help">
          Long responses are saved as text and require an instructor to assign points.
        </p>
      )}
      <Textarea
        label="Learning resources (optional)"
        name="resource_links"
        defaultValue={question?.resource_links?.map((resource) => `${resource.label} => ${resource.url}`).join("\n") || ""}
        rows={3}
        hint="Add up to five links, one per line as label => https://example.com."
      />
      <Textarea label="Explanation shown after submission (optional)" name="explanation" defaultValue={question?.explanation || ""} maxLength={10000} rows={3} />
      <div className="instructor-form-checks">
        {questionType === "FILL_IN_THE_BLANK" && (
          <Checkbox
            label="Require manual grading"
            name="grading_mode"
            value="MANUAL"
            defaultChecked={question?.grading_mode === "MANUAL"}
          />
        )}
        {["SHORT_ANSWER", "LONG_ANSWER"].includes(questionType) && (
          <p className="instructor-form-help">
            Manual grading is required for subjective responses. Learners will not receive an automatic score.
          </p>
        )}
        {questionType === "FILL_IN_THE_BLANK" && (
          <Checkbox label="Case-sensitive accepted answers" name="case_sensitive" defaultChecked={question?.case_sensitive || false} />
        )}
      </div>
      {question && <p className="instructor-form-help">Question and option edits are saved together and are blocked after any attempt has started.</p>}
      <ActionMessage state={state} />
      <Button type="submit" loading={pending}>{question ? "Save question" : "Add question"}</Button>
    </form>
  );
}

export function InstructorQuestionBankSaveForm({
  courseId,
  assessmentId,
  questionId,
}) {
  const [state, action, pending] = useActionState(
    saveInstructorQuestionToBank,
    initialState,
  );
  return (
    <form action={action} className="instructor-inline-form">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="assessment_id" value={assessmentId} />
      <input type="hidden" name="question_id" value={questionId} />
      <ActionMessage state={state} />
      <Button type="submit" variant="outline" loading={pending}>
        Save to course question bank
      </Button>
    </form>
  );
}

export function InstructorQuestionBankImportForm({
  courseId,
  assessmentId,
  items,
}) {
  const [state, action, pending] = useActionState(
    importInstructorQuestionBankItem,
    initialState,
  );
  return (
    <form action={action} className="instructor-form instructor-bank-import-form">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="assessment_id" value={assessmentId} />
      <Select label="Course bank question" name="bank_item_id" required>
        <option value="" disabled>Select a question</option>
        {items.map((item) => (
          <option value={item.id} key={item.id}>
            {item.question_text.slice(0, 100)} · {item.question_type.replaceAll("_", " ").toLowerCase()}
          </option>
        ))}
      </Select>
      <ActionMessage state={state} />
      <Button type="submit" loading={pending} disabled={!items.length}>
        Import question
      </Button>
    </form>
  );
}

export function InstructorDeleteForm({ action, fields, label }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="instructor-delete-form">
      {Object.entries(fields).map(([name, value]) => <input type="hidden" name={name} value={value} key={name} />)}
      <ActionMessage state={state} />
      <Button
        type="submit"
        variant="outline"
        loading={pending}
        leftIcon={<Trash2 size={15} aria-hidden="true" />}
        formAction={formAction}
        onClick={(event) => {
          if (!window.confirm("Delete this item? This cannot be undone.")) event.preventDefault();
        }}
      >
        {label}
      </Button>
    </form>
  );
}

export function InstructorPublishForm({ courseId, assessment }) {
  const [state, action, pending] = useActionState(setInstructorAssessmentPublished, initialState);
  return (
    <form action={action} className="instructor-publish-form">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="assessment_id" value={assessment.id} />
      <input type="hidden" name="is_published" value={assessment.is_published ? "false" : "true"} />
      <ActionMessage state={state} />
      <Button
        type="submit"
        variant={assessment.is_published ? "outline" : "primary"}
        loading={pending}
        onClick={(event) => {
          if (assessment.is_published && !window.confirm("Unpublish this assessment? Existing attempts and results will be preserved.")) event.preventDefault();
          if (!assessment.is_published && !window.confirm("Publish this assessment for learners enrolled in this course?")) event.preventDefault();
        }}
      >
        {assessment.is_published ? "Unpublish assessment" : "Publish assessment"}
      </Button>
    </form>
  );
}

export function InstructorGradeForm({ answerId, maxPoints }) {
  const [state, action, pending] = useActionState(gradeInstructorAnswer, initialState);
  return (
    <form action={action} className="instructor-grade-form">
      <input type="hidden" name="answer_id" value={answerId} />
      <Input label={`Points (max ${maxPoints})`} name="points" type="number" min="0" max={maxPoints} step="0.01" required />
      <Button type="submit" loading={pending}>Save grade</Button>
      <ActionMessage state={state} />
    </form>
  );
}

export function InstructorProfileForm({ profile }) {
  const [state, action, pending] = useActionState(saveInstructorProfile, initialState);
  return (
    <form action={action} className="instructor-form">
      <Input label="Display name" name="full_name" defaultValue={profile.full_name} maxLength={120} required />
      <Input label="Public profile image URL (HTTPS)" name="avatar_url" type="url" defaultValue={profile.avatar_url || ""} placeholder="https://…" />
      <p className="instructor-form-help">Sign-in email and instructor role are read-only here. This account can edit only its own profile name and image URL.</p>
      <ActionMessage state={state} />
      <Button type="submit" loading={pending}>Save profile</Button>
    </form>
  );
}

export function InstructorReorderButtons({ courseId, sectionId = null, items, itemId }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  const index = items.findIndex((item) => item.id === itemId);
  const itemLabel = items[index]?.title || "item";

  function move(direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setMessage("");
    startTransition(async () => {
      const result = sectionId
        ? await reorderInstructorLessons(courseId, sectionId, ids)
        : await reorderInstructorSections(courseId, ids);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="instructor-reorder-controls">
      <button type="button" aria-label={`Move ${itemLabel} up`} disabled={pending || index <= 0} onClick={() => move(-1)}>
        {pending ? <LoaderCircle size={15} className="instructor-spin" /> : <ArrowUp size={15} />}
      </button>
      <button type="button" aria-label={`Move ${itemLabel} down`} disabled={pending || index === items.length - 1} onClick={() => move(1)}>
        <ArrowDown size={15} />
      </button>
      {message && <span role="alert">{message}</span>}
    </div>
  );
}

export function InstructorQuestionReorderButtons({
  courseId,
  assessmentId,
  items,
  itemId,
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  const index = items.findIndex((item) => item.id === itemId);

  function move(direction) {
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const ids = items.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setMessage("");
    startTransition(async () => {
      const result = await reorderInstructorQuestions(
        courseId,
        assessmentId,
        ids,
      );
      if (result.error) {
        setMessage(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="instructor-reorder-controls">
      <button
        type="button"
        aria-label={`Move question ${index + 1} up`}
        disabled={pending || index <= 0}
        onClick={() => move(-1)}
      >
        {pending ? (
          <LoaderCircle size={15} className="instructor-spin" />
        ) : (
          <ArrowUp size={15} />
        )}
      </button>
      <button
        type="button"
        aria-label={`Move question ${index + 1} down`}
        disabled={pending || index < 0 || index === items.length - 1}
        onClick={() => move(1)}
      >
        <ArrowDown size={15} />
      </button>
      {message && <span role="alert">{message}</span>}
    </div>
  );
}
