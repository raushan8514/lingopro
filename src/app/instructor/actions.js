"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIFFICULTIES = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const LESSON_TYPES = new Set(["VIDEO", "AUDIO", "TEXT", "MIXED"]);
const RESOURCE_TYPES = new Set(["DOCUMENT", "AUDIO", "VIDEO", "LINK", "OTHER"]);
const QUESTION_TYPES = new Set([
  "SINGLE_CHOICE",
  "MULTIPLE_SELECT",
  "TRUE_FALSE",
  "FILL_IN_THE_BLANK",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "MATCHING",
]);

function logInstructorMutation(operation, error) {
  const diagnostic = {
    code: error?.code,
    status: error?.status,
    name: error?.name,
    message: typeof error?.message === "string" ? error.message.slice(0, 500) : undefined,
    details: typeof error?.details === "string" ? error.details.slice(0, 500) : undefined,
    hint: typeof error?.hint === "string" ? error.hint.slice(0, 500) : undefined,
  };
  console.error(`Unable to ${operation}. ${JSON.stringify(diagnostic)}`);
}

function failure(operation, error, message) {
  logInstructorMutation(operation, error);
  return { error: message };
}

function courseSaveError(error, fallback) {
  if (error?.code === "23505") {
    return "That course URL slug is already in use. Choose a different slug and save again.";
  }
  if (error?.code === "23503") {
    return "The selected category is no longer available. Choose an active category or no category.";
  }
  if (error?.code === "23514") {
    return "One or more course fields do not meet the requirements. Review the course details and learning metadata.";
  }
  if (error?.code === "42501" || error?.status === 401) {
    return error.code === "42501"
      ? `Supabase denied this course save (42501). Refresh your session and confirm your instructor role and course ownership. ${
          process.env.NODE_ENV === "development" && typeof error.message === "string"
            ? `Database response: ${error.message.slice(0, 300)}`
            : "If it persists, support should inspect the deployed course insert policy."
        }`
      : "Your Supabase session could not be verified. Sign in again with an instructor account and retry.";
  }
  return fallback;
}

function stringField(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validExternalUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function parseLessonContent(raw) {
  if (!raw) return {};
  let content;
  try {
    content = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !content ||
    typeof content !== "object" ||
    Array.isArray(content) ||
    (content.blocks !== undefined && !Array.isArray(content.blocks)) ||
    (content.blocks || []).length > 100
  ) {
    return null;
  }
  const supported = new Set([
    "heading",
    "paragraph",
    "vocabulary",
    "grammar",
    "example",
    "list",
    "image",
    "note",
  ]);
  if (
    (content.blocks || []).some(
      (block) =>
        !block ||
        typeof block !== "object" ||
        !supported.has(block.type) ||
        Object.values(block).some(
          (value) => typeof value === "string" && value.length > 10000,
        ),
    )
  ) {
    return null;
  }
  return content;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

async function instructorContext() {
  if (!isSupabaseConfigured()) {
    await requireRole("instructor");
  }
  const client = await createClient();
  const auth = await requireRole("instructor", { supabase: client });
  return {
    instructorId: auth.user.id,
    client,
  };
}

function revalidateInstructorPaths(courseId = null) {
  revalidatePath("/instructor");
  revalidatePath("/instructor/courses");
  revalidatePath("/instructor/assessments");
  if (courseId) {
    revalidatePath(`/instructor/courses/${courseId}`);
    revalidatePath(`/instructor/courses/${courseId}/curriculum`);
    revalidatePath(`/instructor/courses/${courseId}/students`);
    revalidatePath(`/instructor/courses/${courseId}/assessments`);
  }
  revalidatePath("/courses");
  revalidatePath("/student/courses");
}

export async function saveInstructorCourse(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const title = stringField(formData, "title");
  const language = stringField(formData, "language");
  const rawSlug = stringField(formData, "slug");
  const slug =
    rawSlug ||
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const difficulty = stringField(formData, "difficulty");
  const categoryId = stringField(formData, "category_id");
  const shortDescription = stringField(formData, "short_description");
  const description = stringField(formData, "description");
  const learningOutcomes = stringField(formData, "learning_outcomes")
    .split(/\r?\n/)
    .map((outcome) => outcome.trim())
    .filter(Boolean);
  const prerequisites = stringField(formData, "prerequisites");
  const targetAudience = stringField(formData, "target_audience");
  const durationText = stringField(formData, "estimated_duration_minutes");
  const duration = durationText ? Number(durationText) : null;
  const priceText = stringField(formData, "price_cents") || "0";
  const price = Number(priceText);
  const intent = stringField(formData, "intent");

  if (title.length < 1 || title.length > 180) {
    return { error: "Course title must be between 1 and 180 characters." };
  }
  if (!SLUG_PATTERN.test(slug) || slug.length > 180) {
    return { error: "Use a unique course slug with lowercase letters, numbers, and hyphens." };
  }
  if (language.length < 2 || language.length > 80) {
    return { error: "Language must be between 2 and 80 characters." };
  }
  if (!DIFFICULTIES.has(difficulty)) {
    return { error: "Choose a valid course difficulty." };
  }
  if (categoryId && !UUID_PATTERN.test(categoryId)) {
    return { error: "Choose a valid course category." };
  }
  if (shortDescription.length > 500) {
    return { error: "The short description cannot exceed 500 characters." };
  }
  if (description.length > 20000) {
    return { error: "The course description is too long." };
  }
  if (
    learningOutcomes.length > 20 ||
    learningOutcomes.some((outcome) => outcome.length > 300)
  ) {
    return { error: "Add up to 20 learning outcomes, each no longer than 300 characters." };
  }
  if (prerequisites.length > 5000 || targetAudience.length > 5000) {
    return { error: "Prerequisites and target audience cannot exceed 5,000 characters." };
  }
  if (!Number.isInteger(price) || price < 0 || price > 100000000) {
    return { error: "Enter a valid nonnegative price in cents." };
  }
  if (
    duration !== null &&
    (!Number.isInteger(duration) || duration < 1 || duration > 100000)
  ) {
    return { error: "Estimated duration must be between 1 and 100,000 minutes." };
  }
  if (!["save", "submit"].includes(intent)) {
    return { error: "Choose whether to save the draft or submit it for review." };
  }

  let existing = null;
  if (courseId) {
    if (!UUID_PATTERN.test(courseId)) return { error: "The course identifier is invalid." };
    const lookup = await client
      .from("courses")
      .select("id,status")
      .eq("id", courseId)
      .eq("instructor_id", instructorId)
      .maybeSingle();
    if (lookup.error || !lookup.data) {
      return failure(
        "verify course ownership",
        lookup.error || new Error("Course not found"),
        "This course is unavailable or you do not have permission to edit it.",
      );
    }
    existing = lookup.data;
    if (!["DRAFT", "PENDING_REVIEW"].includes(existing.status)) {
      return { error: "Published or archived courses cannot be edited in the instructor workspace." };
    }
  }

  const values = {
    category_id: categoryId || null,
    title,
    slug,
    short_description: shortDescription || null,
    description: description || null,
    learning_outcomes: learningOutcomes,
    prerequisites: prerequisites || null,
    target_audience: targetAudience || null,
    language,
    difficulty,
    estimated_duration_minutes: duration,
    price_cents: price,
    currency: "USD",
  };

  let savedId = courseId;
  if (!existing) {
    const { error } = await client
      .from("courses")
      .insert({
        ...values,
        instructor_id: instructorId,
        status: "DRAFT",
        published_at: null,
      });
    if (error) {
      return failure(
        "create the course draft",
        error,
        courseSaveError(
          error,
          "The draft could not be saved because of a database or connection error. Retry, and contact support if it persists.",
        ),
      );
    }

    const { data: inserted, error: verificationError } = await client
      .from("courses")
      .select("id")
      .eq("slug", slug)
      .eq("instructor_id", instructorId)
      .single();
    if (verificationError || !inserted) {
      return failure(
        "verify the saved course draft",
        verificationError || new Error("The inserted course could not be retrieved."),
        "The draft may have been saved, but its record could not be confirmed. Check My Courses before trying again.",
      );
    }
    savedId = inserted.id;
  } else {
    const { data: updated, error } = await client
      .from("courses")
      .update(values)
      .eq("id", courseId)
      .eq("instructor_id", instructorId)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      return failure(
        "save course details",
        error || new Error("Course update matched no accessible row."),
        courseSaveError(
          error,
          "Course details were not saved or could not be confirmed. Refresh the page and verify that the course is still editable.",
        ),
      );
    }
  }

  if (intent === "submit" && (!existing || existing.status === "DRAFT")) {
    const { data: readinessIssues, error: readinessError } = await client.rpc(
      "get_course_publication_readiness",
      { target_course_id: savedId },
    );
    if (readinessError) {
      return failure(
        "validate the course curriculum",
        readinessError,
        "The draft was saved, but the curriculum could not be validated. Try again.",
      );
    }
    if (readinessIssues?.length) {
      return {
        error: `Draft saved, but it is not ready for review: ${readinessIssues.join(" ")}`,
        courseId: savedId,
      };
    }

    const { error } = await client
      .from("courses")
      .update({ status: "PENDING_REVIEW", published_at: null })
      .eq("id", savedId)
      .eq("instructor_id", instructorId);
    if (error) {
      return failure("submit the course for review", error, "The draft was saved, but it could not be submitted for review.");
    }
  }

  revalidateInstructorPaths(savedId);
  return { success: intent === "submit" ? "Course submitted for review." : "Course draft saved.", courseId: savedId };
}

function courseThumbnailStoragePath(rawUrl, courseId) {
  if (!rawUrl) return null;
  try {
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const thumbnailUrl = new URL(rawUrl);
    const prefix = `/storage/v1/object/public/course-thumbnails/${courseId}/`;
    if (
      thumbnailUrl.origin !== supabaseUrl.origin ||
      !thumbnailUrl.pathname.startsWith(prefix)
    ) {
      return null;
    }
    const filename = decodeURIComponent(thumbnailUrl.pathname.slice(prefix.length));
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) return null;
    return `${courseId}/${filename}`;
  } catch {
    return null;
  }
}

export async function saveInstructorCourseCover(courseId, storagePath) {
  const { instructorId, client } = await instructorContext();
  if (
    !UUID_PATTERN.test(courseId || "") ||
    !new RegExp(`^${courseId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`, "i").test(
      storagePath || "",
    )
  ) {
    return { error: "The course cover upload is invalid." };
  }

  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id,status,thumbnail_url")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (courseError || !course) {
    return failure(
      "verify course cover ownership",
      courseError || new Error("Course not found"),
      "This course is unavailable or you do not have permission to change its cover.",
    );
  }
  if (!["DRAFT", "PENDING_REVIEW"].includes(course.status)) {
    return { error: "Only draft or review-pending course covers can be changed." };
  }

  const filename = storagePath.slice(courseId.length + 1);
  const { data: storedFiles, error: storageError } = await client.storage
    .from("course-thumbnails")
    .list(courseId, { search: filename, limit: 10 });
  if (storageError || !storedFiles?.some((file) => file.name === filename)) {
    return failure(
      "verify the uploaded course cover",
      storageError || new Error("Uploaded file not found."),
      "The uploaded course cover could not be verified.",
    );
  }

  const { data: publicUrl } = client.storage
    .from("course-thumbnails")
    .getPublicUrl(storagePath);
  const { data: updated, error: updateError } = await client
    .from("courses")
    .update({ thumbnail_url: publicUrl.publicUrl })
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    return failure(
      "save the course cover",
      updateError || new Error("Course update was not applied."),
      "The course cover could not be saved.",
    );
  }

  revalidateInstructorPaths(courseId);
  revalidatePath(`/admin/courses/${courseId}`);
  return {
    success: "Course cover updated.",
    previousStoragePath: courseThumbnailStoragePath(course.thumbnail_url, courseId),
  };
}

export async function saveInstructorSection(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const sectionId = stringField(formData, "section_id");
  const title = stringField(formData, "title");
  const description = stringField(formData, "description");
  if (!UUID_PATTERN.test(courseId) || title.length < 1 || title.length > 180 || description.length > 4000) {
    return { error: "Enter a valid section title and description." };
  }

  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id,status")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (courseError || !course) {
    return failure("verify section course ownership", courseError || new Error("Course not found"), "This course is unavailable.");
  }
  if (!["DRAFT", "PENDING_REVIEW"].includes(course.status)) {
    return { error: "Curriculum is read-only while a course is published or archived." };
  }

  if (sectionId) {
    if (!UUID_PATTERN.test(sectionId)) return { error: "The section identifier is invalid." };
    const { data: updated, error } = await client
      .from("course_sections")
      .update({ title, description: description || null })
      .eq("id", sectionId)
      .eq("course_id", courseId)
      .select("id")
      .maybeSingle();
    if (error) return failure("save the section", error, "The section could not be saved.");
    if (!updated) return { error: "This section is unavailable." };
  } else {
    const [lastSection, sectionCount] = await Promise.all([
      client
        .from("course_sections")
        .select("position")
        .eq("course_id", courseId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from("course_sections")
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseId),
    ]);
    const positionError = lastSection.error || sectionCount.error;
    if (positionError) return failure("read course section positions", positionError, "The section could not be created.");
    if ((sectionCount.count || 0) >= 500) return { error: "A course can contain at most 500 sections." };
    const { error } = await client.from("course_sections").insert({
      course_id: courseId,
      title,
      description: description || null,
      position: (lastSection.data?.position ?? -1) + 1,
    });
    if (error) return failure("create the section", error, "The section could not be created.");
  }
  revalidateInstructorPaths(courseId);
  return { success: sectionId ? "Section saved." : "Section created." };
}

export async function deleteInstructorSection(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const sectionId = stringField(formData, "section_id");
  if (!UUID_PATTERN.test(courseId) || !UUID_PATTERN.test(sectionId)) {
    return { error: "The section identifier is invalid." };
  }
  const { data: course, error: courseError } = await client
    .from("courses")
    .select("status")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (courseError || !course || !["DRAFT", "PENDING_REVIEW"].includes(course.status)) {
    return { error: "This section cannot be deleted from the selected course." };
  }
  const { data: section, error: sectionError } = await client
    .from("course_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (sectionError || !section) return { error: "This section is unavailable." };
  const { count, error: countError } = await client
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId);
  if (countError) return failure("check section contents", countError, "The section could not be checked for lessons.");
  if (count) return { error: "Move or remove this section's lessons before deleting the section." };
  const { data: deleted, error } = await client
    .from("course_sections")
    .delete()
    .eq("id", sectionId)
    .eq("course_id", courseId)
    .select("id")
    .maybeSingle();
  if (error) return failure("delete the empty section", error, "The section could not be deleted.");
  if (!deleted) return { error: "This section is unavailable." };
  revalidateInstructorPaths(courseId);
  return { success: "Empty section deleted." };
}

export async function reorderInstructorSections(courseId, orderedIds) {
  const { client } = await instructorContext();
  if (!UUID_PATTERN.test(courseId) || !Array.isArray(orderedIds) || !orderedIds.every((id) => UUID_PATTERN.test(id))) {
    return { error: "The section order is invalid." };
  }
  const { error } = await client.rpc("reorder_course_sections", {
    target_course_id: courseId,
    ordered_section_ids: orderedIds,
  });
  if (error) return failure("reorder course sections", error, "Section order could not be saved.");
  revalidateInstructorPaths(courseId);
  return { success: true };
}

export async function saveInstructorLesson(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const sectionId = stringField(formData, "section_id");
  const lessonId = stringField(formData, "lesson_id");
  const title = stringField(formData, "title");
  const description = stringField(formData, "description");
  const contentType = stringField(formData, "content_type");
  const videoUrl = stringField(formData, "video_url");
  const audioUrl = stringField(formData, "audio_url");
  const durationText = stringField(formData, "duration_seconds");
  const duration = durationText ? Number(durationText) : null;
  const content = parseLessonContent(stringField(formData, "content_json"));
  const isPublished = formData.get("is_published") === "on";
  const isPreview = formData.get("is_preview") === "on";

  if (!UUID_PATTERN.test(courseId) || !UUID_PATTERN.test(sectionId)) return { error: "Choose a valid course section." };
  if (title.length < 1 || title.length > 180 || description.length > 4000) return { error: "Enter a valid lesson title and description." };
  if (!LESSON_TYPES.has(contentType)) return { error: "Choose a supported lesson type." };
  if (!validExternalUrl(videoUrl) || !validExternalUrl(audioUrl)) return { error: "External media must use secure HTTPS URLs." };
  if (videoUrl && audioUrl) return { error: "A lesson can have only one external media source at a time." };
  if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 86400)) return { error: "Duration must be between 1 and 86,400 seconds." };
  if (content === null) return { error: "Lesson content must be valid JSON using supported LingoPro content blocks." };
  if (isPreview && !isPublished) return { error: "Publish a lesson before enabling preview access." };

  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id,status")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (courseError || !course || !["DRAFT", "PENDING_REVIEW"].includes(course.status)) return { error: "Lessons can only be edited in your draft or review-pending courses." };
  const { data: section, error: sectionError } = await client
    .from("course_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (sectionError || !section) return { error: "This section does not belong to the selected course." };

  const values = {
    section_id: sectionId,
    title,
    description: description || null,
    content_type: contentType,
    content,
    video_url: videoUrl || null,
    audio_url: audioUrl || null,
    duration_seconds: duration,
    is_published: isPublished,
    is_preview: isPreview,
  };
  if (lessonId) {
    if (!UUID_PATTERN.test(lessonId)) return { error: "The lesson identifier is invalid." };
    const { data: existingLesson, error: existingLessonError } = await client
      .from("lessons")
      .select("id,video_storage_path,audio_storage_path")
      .eq("id", lessonId)
      .eq("section_id", sectionId)
      .maybeSingle();
    if (existingLessonError || !existingLesson) return { error: "This lesson is unavailable." };
    if (
      (existingLesson.video_storage_path && videoUrl) ||
      (existingLesson.audio_storage_path && audioUrl)
    ) {
      return { error: "This lesson already uses privately stored media. Remove or manage that media in Supabase before adding an external source." };
    }
    const { data: updated, error } = await client
      .from("lessons")
      .update(values)
      .eq("id", lessonId)
      .eq("section_id", sectionId)
      .select("id")
      .maybeSingle();
    if (error) return failure("save lesson details", error, "The lesson could not be saved. Existing learner progress is preserved.");
    if (!updated) return { error: "This lesson is unavailable." };
  } else {
    const [lastLesson, lessonCount] = await Promise.all([
      client
        .from("lessons")
        .select("position")
        .eq("section_id", sectionId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("section_id", sectionId),
    ]);
    const positionError = lastLesson.error || lessonCount.error;
    if (positionError) return failure("read lesson positions", positionError, "The lesson could not be created.");
    if ((lessonCount.count || 0) >= 1000) return { error: "A section can contain at most 1,000 lessons." };
    const { error } = await client.from("lessons").insert({
      ...values,
      position: (lastLesson.data?.position ?? -1) + 1,
    });
    if (error) return failure("create the lesson", error, "The lesson could not be created.");
  }
  revalidateInstructorPaths(courseId);
  return { success: lessonId ? "Lesson saved." : "Lesson created." };
}

export async function deleteInstructorLesson(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const sectionId = stringField(formData, "section_id");
  const lessonId = stringField(formData, "lesson_id");
  if (![courseId, sectionId, lessonId].every((id) => UUID_PATTERN.test(id))) return { error: "The lesson identifier is invalid." };
  const { data: course, error: courseError } = await client
    .from("courses")
    .select("status")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (courseError || !course || !["DRAFT", "PENDING_REVIEW"].includes(course.status)) return { error: "This lesson cannot be deleted from the selected course." };
  const { data: lesson, error: lessonError } = await client
    .from("lessons")
    .select("id,course_sections!inner(course_id)")
    .eq("id", lessonId)
    .eq("section_id", sectionId)
    .eq("course_sections.course_id", courseId)
    .maybeSingle();
  if (lessonError || !lesson) return { error: "This lesson is unavailable." };

  const [progressCount, resourceCount, quizCount] = await Promise.all([
    client.from("lesson_progress").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId),
    client.from("lesson_resources").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId),
    client.from("quizzes").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId),
  ]);
  const queryError = progressCount.error || resourceCount.error || quizCount.error;
  if (queryError) return failure("check lesson history", queryError, "The lesson could not be checked for student history.");
  if (progressCount.count || resourceCount.count || quizCount.count) {
    return { error: "This lesson has progress, resources, or assessments. Keep it to preserve learner history." };
  }
  const { data: deleted, error } = await client
    .from("lessons")
    .delete()
    .eq("id", lessonId)
    .eq("section_id", sectionId)
    .select("id")
    .maybeSingle();
  if (error) return failure("delete the lesson", error, "The lesson could not be deleted.");
  if (!deleted) return { error: "This lesson is unavailable." };
  revalidateInstructorPaths(courseId);
  return { success: "Lesson deleted." };
}

export async function reorderInstructorLessons(courseId, sectionId, orderedIds) {
  const { client } = await instructorContext();
  if (![courseId, sectionId].every((id) => UUID_PATTERN.test(id)) || !Array.isArray(orderedIds) || !orderedIds.every((id) => UUID_PATTERN.test(id))) {
    return { error: "The lesson order is invalid." };
  }
  const { error } = await client.rpc("reorder_section_lessons", {
    target_course_id: courseId,
    target_section_id: sectionId,
    ordered_lesson_ids: orderedIds,
  });
  if (error) return failure("reorder lessons", error, "Lesson order could not be saved.");
  revalidateInstructorPaths(courseId);
  return { success: true };
}

export async function saveInstructorResource(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const lessonId = stringField(formData, "lesson_id");
  const title = stringField(formData, "title");
  const resourceType = stringField(formData, "resource_type");
  const externalUrl = stringField(formData, "external_url");
  if (![courseId, lessonId].every((id) => UUID_PATTERN.test(id)) || title.length < 1 || title.length > 180 || !RESOURCE_TYPES.has(resourceType) || !validExternalUrl(externalUrl) || !externalUrl) {
    return { error: "Enter a title, resource type, and secure HTTPS link." };
  }
  const { data: lesson, error: lessonError } = await client
    .from("lessons")
    .select("id,course_sections!inner(course_id,courses!inner(instructor_id,status))")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonError || !lesson || lesson.course_sections?.course_id !== courseId) return { error: "This lesson is unavailable." };
  const course = Array.isArray(lesson.course_sections.courses)
    ? lesson.course_sections.courses[0]
    : lesson.course_sections.courses;
  if (course?.instructor_id !== instructorId || !["DRAFT", "PENDING_REVIEW"].includes(course.status)) return { error: "Resources can only be added to your draft or review-pending courses." };

  const { error } = await client.from("lesson_resources").insert({
    lesson_id: lessonId,
    title,
    resource_type: resourceType,
    external_url: externalUrl,
    storage_bucket: "learning-resources",
  });
  if (error) return failure("add the learning resource", error, "The resource could not be added.");
  revalidateInstructorPaths(courseId);
  return { success: "Resource added." };
}

export async function deleteInstructorResource(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const lessonId = stringField(formData, "lesson_id");
  const resourceId = stringField(formData, "resource_id");
  if (![courseId, lessonId, resourceId].every((id) => UUID_PATTERN.test(id))) return { error: "The resource identifier is invalid." };
  const { data: lesson, error: lessonError } = await client
    .from("lessons")
    .select("id,course_sections!inner(course_id,courses!inner(instructor_id,status))")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonError || !lesson) return { error: "This lesson is unavailable." };
  const course = Array.isArray(lesson.course_sections.courses)
    ? lesson.course_sections.courses[0]
    : lesson.course_sections.courses;
  if (lesson.course_sections.course_id !== courseId || course?.instructor_id !== instructorId || !["DRAFT", "PENDING_REVIEW"].includes(course.status)) return { error: "This resource cannot be removed." };
  const { data: resource, error: resourceError } = await client
    .from("lesson_resources")
    .select("id,storage_path")
    .eq("id", resourceId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (resourceError || !resource) return { error: "This resource is unavailable." };
  if (resource.storage_path) return { error: "Private file resources must be removed from Storage and the database together; this workspace does not perform file removal." };
  const { data: deleted, error } = await client
    .from("lesson_resources")
    .delete()
    .eq("id", resourceId)
    .eq("lesson_id", lessonId)
    .is("storage_path", null)
    .select("id")
    .maybeSingle();
  if (error) return failure("remove the learning resource", error, "The resource could not be removed.");
  if (!deleted) return { error: "This resource is unavailable." };
  revalidateInstructorPaths(courseId);
  return { success: "Resource removed." };
}

export async function saveInstructorAssessment(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const assessmentId = stringField(formData, "assessment_id");
  const title = stringField(formData, "title");
  const description = stringField(formData, "description");
  const instructions = stringField(formData, "instructions");
  const lessonId = stringField(formData, "lesson_id");
  const sectionId = stringField(formData, "section_id");
  const scope = stringField(formData, "assessment_scope") || (lessonId ? "LESSON_CHECKPOINT" : "COURSE");
  const type = stringField(formData, "assessment_type");
  const timeText = stringField(formData, "time_limit_seconds");
  const passingText = stringField(formData, "passing_score");
  const attemptsText = stringField(formData, "maximum_attempts");
  const negativeText = stringField(formData, "negative_marking") || "0";
  const availableFrom = parseDate(stringField(formData, "available_from"));
  const availableUntil = parseDate(stringField(formData, "available_until"));
  const timeLimit = timeText ? Number(timeText) : null;
  const passingScore = passingText ? Number(passingText) : null;
  const maxAttempts = attemptsText ? Number(attemptsText) : null;
  const negativeMarking = Number(negativeText);

  if (!UUID_PATTERN.test(courseId) || title.length < 1 || title.length > 180 || description.length > 5000 || instructions.length > 10000) return { error: "Enter valid assessment title and instructions." };
  if (!["PRACTICE", "EXAM"].includes(type)) return { error: "Choose practice or examination." };
  if (!["COURSE", "LESSON_CHECKPOINT", "MODULE", "FINAL"].includes(scope)) return { error: "Choose a valid course placement." };
  if (scope === "LESSON_CHECKPOINT" && !UUID_PATTERN.test(lessonId)) return { error: "Choose a lesson for this checkpoint." };
  if (scope === "MODULE" && !UUID_PATTERN.test(sectionId)) return { error: "Choose a module for this assessment." };
  if (scope !== "LESSON_CHECKPOINT" && lessonId) return { error: "Only lesson checkpoints can be attached to a lesson." };
  if (scope !== "MODULE" && sectionId) return { error: "Only module assessments can be attached to a module." };
  if (scope === "FINAL" && type !== "EXAM") return { error: "A final examination must use the examination assessment type." };
  if (timeLimit !== null && (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 86400)) return { error: "Time limit must be between 1 and 86,400 seconds." };
  if (passingScore !== null && (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100)) return { error: "Passing score must be between 0 and 100." };
  if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100)) return { error: "Maximum attempts must be between 1 and 100." };
  if (!Number.isFinite(negativeMarking) || negativeMarking < 0 || negativeMarking > 1000) return { error: "Negative marking must be between 0 and 1,000 points." };
  if (availableFrom === undefined || availableUntil === undefined || (availableFrom && availableUntil && new Date(availableUntil) <= new Date(availableFrom))) return { error: "Choose a valid availability window." };

  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (courseError || !course) return { error: "This course is unavailable." };
  if (scope === "LESSON_CHECKPOINT") {
    const { data: lesson, error } = await client
      .from("lessons")
      .select("id,is_published,course_sections!inner(course_id)")
      .eq("id", lessonId)
      .maybeSingle();
    if (error || lesson?.course_sections?.course_id !== courseId || !lesson.is_published) return { error: "Choose a published lesson in this course." };
  }
  if (scope === "MODULE") {
    const { data: section, error } = await client
      .from("course_sections")
      .select("id")
      .eq("id", sectionId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (error || !section) return { error: "Choose a module in this course." };
  }

  const values = {
    course_id: courseId,
    lesson_id: scope === "LESSON_CHECKPOINT" ? lessonId : null,
    section_id: scope === "MODULE" ? sectionId : null,
    assessment_scope: scope,
    is_required: formData.get("is_required") === "on",
    required_for_certificate: formData.get("required_for_certificate") === "on",
    title,
    description: description || null,
    instructions: instructions || null,
    assessment_type: type,
    time_limit_seconds: timeLimit,
    passing_score: passingScore,
    maximum_attempts: maxAttempts,
    available_from: availableFrom,
    available_until: availableUntil,
    randomize_questions: formData.get("randomize_questions") === "on",
    randomize_options: formData.get("randomize_options") === "on",
    allow_partial_credit: formData.get("allow_partial_credit") === "on",
    negative_marking: negativeMarking,
    allow_result_review: formData.get("allow_result_review") === "on",
    show_correct_answers: formData.get("show_correct_answers") === "on",
    show_explanations: formData.get("show_explanations") === "on",
    allow_concurrent_attempts: false,
  };

  let savedId = assessmentId;
  if (assessmentId) {
    if (!UUID_PATTERN.test(assessmentId)) return { error: "The assessment identifier is invalid." };
    const { data: updated, error } = await client
      .from("quizzes")
      .update(values)
      .eq("id", assessmentId)
      .eq("course_id", courseId)
      .select("id")
      .maybeSingle();
    if (error) return failure("save assessment settings", error, "Assessment settings could not be saved. Active attempts may prevent scoring changes.");
    if (!updated) return { error: "This assessment is unavailable in the selected course." };
  } else {
    const { data, error } = await client
      .from("quizzes")
      .insert({ ...values, is_published: false })
      .select("id")
      .single();
    if (error || !data) return failure("create assessment draft", error || new Error("Missing ID"), "The assessment draft could not be created.");
    savedId = data.id;
  }
  revalidateInstructorPaths(courseId);
  revalidatePath(`/instructor/assessments/${savedId}`);
  return { success: "Assessment settings saved.", assessmentId: savedId };
}

export async function saveInstructorCertificateRequirements(_previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const lessonPercent = Number(
    stringField(formData, "required_lesson_completion_percent"),
  );
  const finalExamScore = Number(stringField(formData, "minimum_final_exam_score"));

  if (
    !UUID_PATTERN.test(courseId) ||
    !Number.isFinite(lessonPercent) ||
    lessonPercent < 0 ||
    lessonPercent > 100 ||
    !Number.isFinite(finalExamScore) ||
    finalExamScore < 0 ||
    finalExamScore > 100
  ) {
    return { error: "Enter valid course completion and final exam thresholds." };
  }

  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (courseError || !course) return { error: "This course is unavailable." };

  const { error } = await client.from("course_certificate_requirements").upsert(
    {
      course_id: courseId,
      required_lesson_completion_percent: lessonPercent,
      require_required_assessments:
        formData.get("require_required_assessments") === "on",
      require_final_exam: formData.get("require_final_exam") === "on",
      minimum_final_exam_score: finalExamScore,
      updated_by: instructorId,
    },
    { onConflict: "course_id" },
  );
  if (error) {
    return failure(
      "save certificate requirements",
      error,
      "Certificate requirements could not be saved.",
    );
  }

  revalidateInstructorPaths(courseId);
  revalidatePath("/student/achievements");
  revalidatePath("/student/courses");
  return { success: "Certificate requirements saved." };
}

export async function saveInstructorQuestion(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const quizId = stringField(formData, "assessment_id");
  const questionId = stringField(formData, "question_id");
  const prompt = stringField(formData, "question_text");
  const type = stringField(formData, "question_type");
  const explanation = stringField(formData, "explanation");
  const points = Number(stringField(formData, "points") || "1");
  const difficulty = stringField(formData, "difficulty") || null;
  const acceptedAnswers = stringField(formData, "accepted_answers")
    .split(/\r?\n/)
    .map((answer) => answer.trim())
    .filter(Boolean);
  const matchingLines = stringField(formData, "matching_pairs")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const resourceLines = stringField(formData, "resource_links")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (![courseId, quizId].every((id) => UUID_PATTERN.test(id)) || (questionId && !UUID_PATTERN.test(questionId))) return { error: "The assessment or question identifier is invalid." };
  if (prompt.length < 1 || prompt.length > 10000 || explanation.length > 10000) return { error: "Enter a question and an optional explanation within the allowed length." };
  if (!QUESTION_TYPES.has(type) || !Number.isFinite(points) || points <= 0 || points > 100000) return { error: "Choose a supported question type and positive points." };
  if (type === "FILL_IN_THE_BLANK" && formData.get("grading_mode") !== "MANUAL" && !acceptedAnswers.length) return { error: "Add at least one accepted answer for automatic fill-in grading." };
  if (acceptedAnswers.some((answer) => answer.length > 1000) || acceptedAnswers.length > 100) return { error: "Accepted answers are limited to 100 entries of 1,000 characters." };
  if (difficulty && !["EASY", "MEDIUM", "HARD"].includes(difficulty)) return { error: "Choose a valid question difficulty." };
  if (resourceLines.length > 5) return { error: "Add no more than five question resources." };
  const resources = [];
  for (const line of resourceLines) {
    const separator = line.indexOf("=>");
    const label = separator < 0 ? "" : line.slice(0, separator).trim();
    const url = separator < 0 ? "" : line.slice(separator + 2).trim();
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { error: "Enter each resource as label => https://example.com." };
    }
    if (
      !label ||
      label.length > 120 ||
      url.length > 2048 ||
      parsedUrl.protocol !== "https:" ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return { error: "Resources need a short label and a valid HTTPS URL." };
    }
    resources.push({ label, url });
  }
  if (type === "MATCHING" && matchingLines.length < 2) return { error: "Add at least two matching pairs." };
  if (type === "MATCHING" && matchingLines.length > 20) return { error: "Matching questions are limited to 20 pairs." };

  const { data: quiz, error: quizError } = await client
    .from("quizzes")
    .select("id,is_published")
    .eq("id", quizId)
    .eq("course_id", courseId)
    .maybeSingle();
  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (quizError || courseError || !quiz || !course) return { error: "This assessment is not in a course you manage." };
  if (quiz.is_published) return { error: "Unpublish the assessment before changing its questions." };

  const manual = ["SHORT_ANSWER", "LONG_ANSWER"].includes(type) || formData.get("grading_mode") === "MANUAL";
  if (["SHORT_ANSWER", "LONG_ANSWER"].includes(type) && !manual) return { error: "Short- and long-answer questions require manual grading." };
  let options = [];
  let matchingAnswers = [];
  if (["SINGLE_CHOICE", "MULTIPLE_SELECT"].includes(type)) {
    options = stringField(formData, "options")
      .split(/\r?\n/)
      .map((line) => ({
        is_correct: line.startsWith("*"),
        option_text: line.replace(/^\*\s*/, "").trim(),
      }))
      .filter((option) => option.option_text);
    if (options.length < 2 || options.length > 50 || !options.some((option) => option.is_correct)) return { error: "Add 2–50 options, marking at least one correct option with an asterisk." };
    if (type === "SINGLE_CHOICE" && options.filter((option) => option.is_correct).length !== 1) return { error: "Single-choice questions must have exactly one correct option." };
  } else if (type === "TRUE_FALSE") {
    const correct = stringField(formData, "true_false_answer");
    if (!["TRUE", "FALSE"].includes(correct)) return { error: "Choose the correct true/false answer." };
    options = [
      { option_text: "True", is_correct: correct === "TRUE" },
      { option_text: "False", is_correct: correct === "FALSE" },
    ];
  } else if (type === "MATCHING") {
    const pairs = matchingLines.map((line) => {
      const separator = line.indexOf("=>");
      if (separator < 0) return null;
      return {
        prompt: line.slice(0, separator).trim(),
        answer: line.slice(separator + 2).trim(),
      };
    });
    if (pairs.some((pair) => !pair?.prompt || !pair.answer)) {
      return { error: "Enter each matching pair as prompt => answer." };
    }
    if (pairs.some((pair) => pair.prompt.length > 4000 || pair.answer.length > 4000)) {
      return { error: "Matching prompts and answers are limited to 4,000 characters." };
    }
    const prompts = pairs.map((pair) => pair.prompt.toLowerCase());
    const answers = pairs.map((pair) => pair.answer.toLowerCase());
    if (new Set(prompts).size !== prompts.length || new Set(answers).size !== answers.length) {
      return { error: "Matching prompts and answers must each be unique." };
    }
    options = pairs.map((pair) => ({
      option_text: pair.prompt,
      is_correct: false,
    }));
    matchingAnswers = pairs.map((pair) => pair.answer);
  }

  const { data: savedQuestionId, error: saveError } = await client.rpc(
    type === "LONG_ANSWER"
      ? "save_instructor_quiz_question_for_editor"
      : "save_instructor_quiz_question_with_metadata",
    {
      target_course_id: courseId,
      target_quiz_id: quizId,
      target_question_id: questionId || null,
      p_question_text: prompt,
      p_question_type: type,
      p_points: points,
      p_manual_grading: manual,
      p_normalize_whitespace: formData.get("normalize_whitespace") !== "off",
      p_accepted_answers:
        type === "MATCHING"
          ? matchingAnswers
          : type === "FILL_IN_THE_BLANK" && !manual
            ? acceptedAnswers
            : [],
      p_case_sensitive: formData.get("case_sensitive") === "on",
      p_explanation: explanation || null,
      p_question_options: options,
      p_difficulty: difficulty,
      p_resource_links: resources,
    },
  );
  if (saveError || !savedQuestionId) {
    return failure(
      questionId ? "update the assessment question" : "create the assessment question",
      saveError || new Error("Missing question ID"),
      "The question could not be saved. Check its options and confirm no attempts have started.",
    );
  }

  revalidateInstructorPaths(courseId);
  revalidatePath(`/instructor/assessments/${quizId}`);
  return { success: "Question saved." };
}

export async function saveInstructorQuestionToBank(previousState, formData) {
  const { client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const quizId = stringField(formData, "assessment_id");
  const questionId = stringField(formData, "question_id");
  if (![courseId, quizId, questionId].every((id) => UUID_PATTERN.test(id))) {
    return { error: "The question bank reference is invalid." };
  }
  const { data, error } = await client.rpc("save_quiz_question_to_bank", {
    target_course_id: courseId,
    target_quiz_id: quizId,
    target_question_id: questionId,
  });
  if (error || !data) {
    return failure(
      "save a question to the course bank",
      error || new Error("Missing bank item ID"),
      "The question could not be saved to the course bank.",
    );
  }
  revalidateInstructorPaths(courseId);
  revalidatePath(`/instructor/assessments/${quizId}`);
  return { success: "Question saved to the course bank." };
}

export async function importInstructorQuestionBankItem(previousState, formData) {
  const { client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const quizId = stringField(formData, "assessment_id");
  const bankItemId = stringField(formData, "bank_item_id");
  if (![courseId, quizId, bankItemId].every((id) => UUID_PATTERN.test(id))) {
    return { error: "Choose a valid course bank question." };
  }
  const { data, error } = await client.rpc("import_question_bank_item", {
    target_course_id: courseId,
    target_quiz_id: quizId,
    target_bank_item_id: bankItemId,
  });
  if (error || !data) {
    return failure(
      "import a question from the course bank",
      error || new Error("Missing imported question ID"),
      "The question could not be imported. Confirm the assessment is an editable draft and the question is not already included.",
    );
  }
  revalidateInstructorPaths(courseId);
  revalidatePath(`/instructor/assessments/${quizId}`);
  return { success: "Question imported into the assessment." };
}

export async function deleteInstructorQuestion(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const quizId = stringField(formData, "assessment_id");
  const questionId = stringField(formData, "question_id");
  if (![courseId, quizId, questionId].every((id) => UUID_PATTERN.test(id))) return { error: "The question identifier is invalid." };
  const { data: quiz, error: quizError } = await client
    .from("quizzes")
    .select("id,is_published")
    .eq("id", quizId)
    .eq("course_id", courseId)
    .maybeSingle();
  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (quizError || courseError || !quiz || !course) return { error: "This assessment is unavailable." };
  if (quiz.is_published) return { error: "Unpublish the assessment before deleting its questions." };
  const { data: deleted, error } = await client
    .from("quiz_questions")
    .delete()
    .eq("id", questionId)
    .eq("quiz_id", quizId)
    .select("id")
    .maybeSingle();
  if (error) return failure("delete the assessment question", error, "This question cannot be deleted while attempts exist.");
  if (!deleted) return { error: "This question is unavailable." };
  revalidateInstructorPaths(courseId);
  revalidatePath(`/instructor/assessments/${quizId}`);
  return { success: "Question deleted." };
}

export async function reorderInstructorQuestions(courseId, assessmentId, orderedIds) {
  const { instructorId, client } = await instructorContext();
  if (
    ![courseId, assessmentId].every((id) => UUID_PATTERN.test(id)) ||
    !Array.isArray(orderedIds) ||
    orderedIds.length > 100 ||
    !orderedIds.every((id) => UUID_PATTERN.test(id)) ||
    new Set(orderedIds).size !== orderedIds.length
  ) {
    return { error: "The question order is invalid. Refresh and try again." };
  }

  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (courseError || !course) {
    return { error: "This assessment is not in a course you manage." };
  }

  const { error } = await client.rpc("reorder_instructor_quiz_questions", {
    target_course_id: courseId,
    target_quiz_id: assessmentId,
    ordered_question_ids: orderedIds,
  });
  if (error) {
    return failure(
      "reorder assessment questions",
      error,
      "The questions could not be reordered. Confirm the assessment is an editable draft with no learner attempts.",
    );
  }

  revalidateInstructorPaths(courseId);
  revalidatePath(`/instructor/assessments/${assessmentId}`);
  return { success: "Question order saved." };
}

export async function setInstructorAssessmentPublished(previousState, formData) {
  const { instructorId, client } = await instructorContext();
  const courseId = stringField(formData, "course_id");
  const assessmentId = stringField(formData, "assessment_id");
  const isPublished = stringField(formData, "is_published") === "true";
  if (![courseId, assessmentId].every((id) => UUID_PATTERN.test(id))) return { error: "The assessment identifier is invalid." };
  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();
  if (courseError || !course) return { error: "This assessment is not in a course you manage." };
  const { data, error } = await client
    .from("quizzes")
    .update({ is_published: isPublished })
    .eq("id", assessmentId)
    .eq("course_id", courseId)
    .select("id")
    .maybeSingle();
  if (error) return failure(isPublished ? "publish the assessment" : "unpublish the assessment", error, "The assessment could not be updated. Ensure it has valid questions and answers.");
  if (!data) return { error: "This assessment is unavailable in the selected course." };
  revalidateInstructorPaths(courseId);
  revalidatePath(`/instructor/assessments/${assessmentId}`);
  revalidatePath("/student/assessments");
  return { success: isPublished ? "Assessment published." : "Assessment unpublished." };
}

export async function gradeInstructorAnswer(previousState, formData) {
  await requireRole("instructor");
  const answerId = stringField(formData, "answer_id");
  const points = Number(stringField(formData, "points"));
  if (!UUID_PATTERN.test(answerId) || !Number.isFinite(points) || points < 0 || points > 100000) return { error: "Enter a valid score for this response." };
  const client = await createClient();
  const { error } = await client.rpc("grade_quiz_answer", {
    target_answer_id: answerId,
    points_awarded: points,
  });
  if (error) return failure("grade the manual response", error, "The response could not be graded.");
  revalidatePath("/instructor");
  revalidatePath("/instructor/assessments");
  revalidatePath("/instructor/assessments/[assessmentId]", "page");
  revalidatePath("/student/assessments/history");
  return { success: "Response graded." };
}

export async function saveInstructorProfile(previousState, formData) {
  const auth = await requireRole("instructor");
  const fullName = stringField(formData, "full_name");
  const avatarUrl = stringField(formData, "avatar_url");
  if (fullName.length < 1 || fullName.length > 120 || !validExternalUrl(avatarUrl)) return { error: "Enter a valid display name and HTTPS image URL." };
  const client = await createClient();
  const { error } = await client
    .from("profiles")
    .update({ full_name: fullName, avatar_url: avatarUrl || null })
    .eq("id", auth.user.id);
  if (error) return failure("save instructor profile", error, "Your profile could not be saved.");
  revalidatePath("/instructor");
  revalidatePath("/instructor/profile");
  revalidatePath("/instructor/settings");
  revalidatePath("/instructors");
  return { success: "Instructor profile saved." };
}
