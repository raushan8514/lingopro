import "server-only";
import { notFound } from "next/navigation";
import { getStudentIdentity } from "@/lib/student/data";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 500;
const MAX_PAGES = 20;
const SIGNED_URL_SECONDS = 1800;

const mediaExtensions = {
  video: new Set(["mp4", "webm", "ogg", "m4v"]),
  audio: new Set(["mp3", "m4a", "aac", "wav", "ogg", "opus", "flac", "webm"]),
};

function logLearningReadFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

async function read(operation, query) {
  const { data, error } = await query;
  if (error) {
    logLearningReadFailure(operation, error);
    throw new Error(`The learning workspace could not load ${operation}.`);
  }
  return data;
}

async function readAll(operation, queryFactory) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE_SIZE;
    const batch = await read(
      operation,
      queryFactory().range(start, start + PAGE_SIZE - 1),
    );
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new Error(`The learning workspace exceeds the supported ${operation} limit.`);
}

function isSafeMediaTransport(url) {
  return url.protocol === "https:";
}

function fileExtension(url) {
  return url.pathname.split(".").at(-1)?.toLowerCase() || "";
}

function getYouTubeVideoId(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  let id = "";
  if (host === "youtu.be" || host === "www.youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (
    ["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)
  ) {
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
    else if (["embed", "shorts", "live"].includes(segments[0])) id = segments[1] || "";
  }

  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

async function resolveMediaSource(client, { kind, url, bucket, path }) {
  let playableUrl = url;
  if (path) {
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error) {
      logLearningReadFailure(`authorize private ${kind} media`, error);
      return {
        kind: "unavailable",
        message: "This private media file is temporarily unavailable.",
      };
    }
    playableUrl = data.signedUrl;
  }

  if (!playableUrl) return null;

  const youtubeId = kind === "video" ? getYouTubeVideoId(playableUrl) : null;
  if (youtubeId) return { kind: "youtube", videoId: youtubeId };

  let parsedUrl;
  try {
    parsedUrl = new URL(playableUrl);
  } catch {
    return {
      kind: "unsupported",
      message: `This ${kind} source is not a valid media URL.`,
    };
  }

  if (!isSafeMediaTransport(parsedUrl) || !mediaExtensions[kind].has(fileExtension(parsedUrl))) {
    return {
      kind: "unsupported",
      message: `This ${kind} format is not supported. Use an approved ${
        kind === "video" ? "YouTube embed or MP4/WebM video file" : "audio file"
      }.`,
    };
  }

  return { kind: "file", url: parsedUrl.toString() };
}

function safeExternalResourceUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function resolveLessonMedia(client, lesson) {
  const [video, audio] = await Promise.all([
    resolveMediaSource(client, {
      kind: "video",
      url: lesson.video_url,
      path: lesson.video_storage_path,
      bucket: "lesson-media",
    }),
    resolveMediaSource(client, {
      kind: "audio",
      url: lesson.audio_url,
      path: lesson.audio_storage_path,
      bucket: "lesson-media",
    }),
  ]);
  return { video, audio };
}

async function getCourseContext(courseId) {
  if (!UUID_PATTERN.test(courseId || "")) notFound();

  const [identity, client] = await Promise.all([
    getStudentIdentity(),
    createClient({ allowCookieWrites: false }),
  ]);
  const course = await read(
    "the enrolled course",
    client
      .from("courses")
      .select("id,title,slug,description,short_description,language,difficulty,status,thumbnail_url")
      .eq("id", courseId)
      .maybeSingle(),
  );
  if (!course || !["PUBLISHED", "ARCHIVED"].includes(course.status)) notFound();

  const access = await read(
    "course access",
    client.rpc("can_access_course", { target_course_id: courseId }),
  );
  if (access !== true) notFound();

  const now = new Date().toISOString();
  const enrollment = await read(
    "your course enrollment",
    client
      .from("enrollments")
      .select("id,status,enrolled_at,expires_at")
      .eq("student_id", identity.id)
      .eq("course_id", courseId)
      .in("status", ["ACTIVE", "COMPLETED"])
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (!enrollment) notFound();

  return { identity, client, course, enrollment };
}

async function getCurriculum(client, courseId, studentId) {
  const sectionRows = await readAll("the course curriculum", () =>
    client
      .from("course_sections")
      .select("id,title,description,position")
      .eq("course_id", courseId)
      .order("position", { ascending: true })
      .order("id", { ascending: true }),
  );
  if (!sectionRows.length) return { sections: [], lessons: [] };

  const sectionById = new Map(sectionRows.map((section) => [section.id, section]));
  const lessonRows = [];
  for (let index = 0; index < sectionRows.length; index += 100) {
    const ids = sectionRows.slice(index, index + 100).map((section) => section.id);
    lessonRows.push(
      ...(await readAll("published lessons", () =>
        client
          .from("lessons")
          .select("id,section_id,title,description,content_type,duration_seconds,position,is_preview")
          .in("section_id", ids)
          .eq("is_published", true)
          .order("position", { ascending: true })
          .order("id", { ascending: true }),
      )),
    );
  }

  const lessons = lessonRows
    .map((lesson) => ({ ...lesson, sectionPosition: sectionById.get(lesson.section_id)?.position ?? 0 }))
    .sort(
      (left, right) =>
        left.sectionPosition - right.sectionPosition ||
        left.position - right.position ||
        left.id.localeCompare(right.id),
    );
  const lessonIds = lessons.map((lesson) => lesson.id);
  const progressRows = [];
  for (let index = 0; index < lessonIds.length; index += 100) {
    const ids = lessonIds.slice(index, index + 100);
    progressRows.push(
      ...(await readAll("lesson progress", () =>
        client
          .from("lesson_progress")
          .select("lesson_id,status,progress_percent,last_position_seconds,furthest_position_seconds,last_accessed_at,started_at,completed_at,updated_at")
          .eq("student_id", studentId)
          .in("lesson_id", ids)
          .order("last_accessed_at", { ascending: false, nullsFirst: false }),
      )),
    );
  }
  const progressByLesson = new Map(progressRows.map((row) => [row.lesson_id, row]));
  const sections = sectionRows.map((section) => ({
    ...section,
    lessons: lessons
      .filter((lesson) => lesson.section_id === section.id)
      .map(({ sectionPosition, ...lesson }) => ({
        ...lesson,
        progress: progressByLesson.get(lesson.id) || null,
      })),
  }));
  return {
    sections,
    lessons: lessons.map(({ sectionPosition, ...lesson }) => ({
      ...lesson,
      progress: progressByLesson.get(lesson.id) || null,
    })),
  };
}

export async function getLearningCourse(courseId, selectedLessonId = null) {
  const { identity, client, course, enrollment } = await getCourseContext(courseId);
  const { sections, lessons } = await getCurriculum(client, courseId, identity.id);
  const assessments = await read(
    "published course assessments",
    client
      .from("quizzes")
      .select("id,lesson_id,section_id,assessment_scope,is_required,required_for_certificate,title,description,assessment_type,time_limit_seconds,passing_score,maximum_attempts")
      .eq("course_id", courseId)
      .eq("is_published", true)
      .order("created_at", { ascending: true }),
  );
  const assessmentQuestions = assessments.length
    ? await read(
        "published assessment questions",
        client
          .from("quiz_questions")
          .select("id,quiz_id")
          .in("quiz_id", assessments.map((assessment) => assessment.id)),
      )
    : [];
  const questionCounts = new Map();
  for (const question of assessmentQuestions) {
    questionCounts.set(
      question.quiz_id,
      (questionCounts.get(question.quiz_id) || 0) + 1,
    );
  }
  const assessmentAttempts = assessments.length
    ? await read(
        "your assessment results",
        client
          .from("quiz_attempts")
          .select("id,quiz_id,attempt_number,status,score,total_points,started_at,submitted_at")
          .eq("student_id", identity.id)
          .in("quiz_id", assessments.map((assessment) => assessment.id))
          .order("attempt_number", { ascending: false }),
      )
    : [];
  const certificateEligibility = await read(
    "certificate eligibility",
    client.rpc("get_course_certificate_eligibility", {
      target_enrollment_id: enrollment.id,
    }),
  );
  const attemptsByQuiz = new Map();
  for (const attempt of assessmentAttempts) {
    const list = attemptsByQuiz.get(attempt.quiz_id) || [];
    list.push(attempt);
    attemptsByQuiz.set(attempt.quiz_id, list);
  }
  const courseAssessments = assessments.map((assessment) => {
    const attempts = attemptsByQuiz.get(assessment.id) || [];
    const gradedAttempts = attempts.filter((attempt) => attempt.status === "GRADED");
    const bestAttempt = gradedAttempts.reduce((best, attempt) => {
      const currentPercent = Number(attempt.score) / Number(attempt.total_points);
      const bestPercent = best
        ? Number(best.score) / Number(best.total_points)
        : -1;
      return currentPercent > bestPercent ? attempt : best;
    }, null);
    const bestScorePercent =
      bestAttempt && Number(bestAttempt.total_points) > 0
        ? Math.round((Number(bestAttempt.score) / Number(bestAttempt.total_points)) * 100)
        : null;
    return {
      ...assessment,
      questionCount: questionCounts.get(assessment.id) || 0,
      attempts,
      bestAttempt,
      bestScorePercent,
      passed:
        bestScorePercent !== null &&
        assessment.passing_score !== null &&
        bestScorePercent >= Number(assessment.passing_score),
    };
  });
  const resumeLesson =
    lessons
      .filter(
        (lesson) =>
          lesson.progress?.status !== "COMPLETED" &&
          lesson.progress?.last_accessed_at,
      )
      .sort(
        (left, right) =>
          new Date(right.progress.last_accessed_at).getTime() -
          new Date(left.progress.last_accessed_at).getTime(),
      )[0] ||
    lessons.find((lesson) => lesson.progress?.status !== "COMPLETED") ||
    lessons.at(-1) ||
    null;

  if (!selectedLessonId) {
    return {
      identity,
      course,
      enrollment,
      sections,
      lessons,
      assessments: courseAssessments,
      certificateEligibility,
      selectedLesson: null,
      previousLesson: null,
      nextLesson: resumeLesson,
      completedLessons: lessons.filter((lesson) => lesson.progress?.status === "COMPLETED").length,
    };
  }

  if (!UUID_PATTERN.test(selectedLessonId)) notFound();
  const index = lessons.findIndex((lesson) => lesson.id === selectedLessonId);
  if (index < 0) notFound();

  const lesson = await read(
    "the selected lesson",
    client
      .from("lessons")
      .select("id,section_id,title,description,content_type,content,video_url,audio_url,video_storage_path,audio_storage_path,duration_seconds,position,is_preview,is_published")
      .eq("id", selectedLessonId)
      .eq("is_published", true)
      .maybeSingle(),
  );
  if (!lesson || lesson.section_id !== lessons[index].section_id) notFound();

  const resources = await read(
    "lesson resources",
    client
      .from("lesson_resources")
      .select("id,title,resource_type,storage_path,storage_bucket,external_url,file_size_bytes")
      .eq("lesson_id", selectedLessonId)
      .order("title", { ascending: true }),
  );
  const resolvedResources = await Promise.all(
    resources.map(async (resource) => {
      if (resource.storage_path) {
        const { data, error } = await client.storage
          .from(resource.storage_bucket)
          .createSignedUrl(resource.storage_path, SIGNED_URL_SECONDS);
        if (error) {
          logLearningReadFailure("authorize a private lesson resource", error);
          return {
            id: resource.id,
            title: resource.title,
            type: resource.resource_type,
            size: resource.file_size_bytes,
            url: null,
            unavailable: true,
          };
        }
        return {
          id: resource.id,
          title: resource.title,
          type: resource.resource_type,
          size: resource.file_size_bytes,
          url: data.signedUrl,
          unavailable: false,
        };
      }

      const url = safeExternalResourceUrl(resource.external_url);
      return {
        id: resource.id,
        title: resource.title,
        type: resource.resource_type,
        size: resource.file_size_bytes,
        url,
        unavailable: !url,
      };
    }),
  );

  return {
    identity,
    course,
    enrollment,
    sections,
    lessons,
    assessments: courseAssessments,
    certificateEligibility,
    selectedLesson: {
      ...lesson,
      progress: lessons[index].progress,
      media: await resolveLessonMedia(client, lesson),
    },
    resources: resolvedResources,
    previousLesson: lessons[index - 1] || null,
    nextLesson: lessons[index + 1] || null,
    completedLessons: lessons.filter((item) => item.progress?.status === "COMPLETED").length,
  };
}

export function isLearningRouteId(value) {
  return UUID_PATTERN.test(value || "");
}
