import "server-only";
import { cache } from "react";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  addCalendarDays,
  getDateKeysEndingToday,
  getLocalDateKey,
  getLocalDayStart,
  getWeekStartKey,
  isValidTimeZone,
} from "@/lib/student/time";

const COURSE_PAGE_SIZE = 12;
const ACTIVITY_PAGE_SIZE = 20;
const QUERY_PAGE_SIZE = 500;
const MAX_QUERY_PAGES = 20;

function logDatabaseError(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

async function execute(operation, request) {
  const { data, error } = await request;
  if (error) {
    logDatabaseError(operation, error);
    throw new Error(`Student data could not be loaded: ${operation}.`);
  }
  return data;
}

async function getClient() {
  return createClient({ allowCookieWrites: false });
}

export const getStudentIdentity = cache(async () => {
  const auth = await requireRole("student");
  return {
    id: auth.user.id,
    email: auth.user.email || "",
    fullName: auth.fullName || "",
  };
});

function emptyGoals() {
  return {
    daily_lesson_target: 1,
    weekly_lesson_target: 5,
    timezone: "UTC",
    preferred_language: "",
  };
}

async function getGoals(client, studentId) {
  const { data, error } = await client
    .from("student_learning_goals")
    .select("daily_lesson_target,weekly_lesson_target,timezone,preferred_language")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    logDatabaseError("load learning goals", error);
    throw new Error("Student learning goals could not be loaded.");
  }

  const goals = data || emptyGoals();
  if (!isValidTimeZone(goals.timezone)) {
    throw new Error("The saved learning timezone is invalid. Update it in Settings.");
  }

  return goals;
}

async function getProfile(client, identity) {
  const profile = await execute(
    "load the student profile",
    client
      .from("profiles")
      .select("id,full_name,avatar_url,avatar_path,created_at")
      .eq("id", identity.id)
      .single(),
  );

  let avatarUrl = profile.avatar_url;
  let avatarUnavailable = false;
  if (profile.avatar_path) {
    const { data, error } = await client.storage
      .from("user-avatars")
      .createSignedUrl(profile.avatar_path, 3600);

    if (error) {
      logDatabaseError("create a private avatar link", error);
      avatarUnavailable = true;
    } else {
      avatarUrl = data.signedUrl;
    }
  }

  return {
    ...profile,
    avatar_url: avatarUrl,
    avatar_unavailable: avatarUnavailable,
    email: identity.email,
  };
}

async function getProfileAndGoals(client, identity) {
  const [profile, goals] = await Promise.all([
    getProfile(client, identity),
    getGoals(client, identity.id),
  ]);
  return { profile, goals };
}

async function getUnreadNotificationCount(client, studentId) {
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", studentId)
    .eq("is_read", false);

  if (error) {
    logDatabaseError("count unread notifications", error);
    throw new Error("Student notifications could not be loaded.");
  }

  return count || 0;
}

export async function getStudentShellData() {
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const [profile, unreadCount] = await Promise.all([
    getProfile(client, identity),
    getUnreadNotificationCount(client, identity.id),
  ]);
  return { identity, profile, unreadCount };
}

async function getCourseProgress(client) {
  return execute(
    "calculate course progress",
    client.rpc("get_student_course_progress"),
  );
}

async function getPublicInstructorProfiles(client, instructorIds) {
  const ids = [...new Set(instructorIds.filter(Boolean))].slice(0, 100);
  if (!ids.length) return new Map();

  const profiles = await execute(
    "load public instructor names",
    client.rpc("get_public_instructor_profiles", {
      target_instructor_ids: ids,
    }),
  );
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

function toCourseCard(enrollment, progressByCourse, resumeByCourse, instructors) {
  const course = Array.isArray(enrollment.course)
    ? enrollment.course[0]
    : enrollment.course;
  if (!course) return null;

  const progress = progressByCourse.get(course.id);
  const totalLessons = Number(progress?.total_lessons || 0);
  const completedLessons = Number(progress?.completed_lessons || 0);
  const instructor = instructors.get(course.instructor_id);
  const resume = resumeByCourse.get(course.id);

  return {
    id: course.id,
    enrollmentId: enrollment.id,
    title: course.title,
    slug: course.slug,
    description: course.short_description,
    thumbnailUrl: course.thumbnail_url,
    estimatedDurationMinutes: course.estimated_duration_minutes,
    status: enrollment.status,
    enrolledAt: enrollment.enrolled_at,
    instructorId: course.instructor_id,
    instructorName: instructor?.full_name || "LingoPro instructor",
    instructorAvatar: instructor?.avatar_url || null,
    totalLessons,
    completedLessons,
    inProgressLessons: Number(progress?.in_progress_lessons || 0),
    progressPercent: totalLessons
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0,
    lastLessonTitle: progress?.last_lesson_title || null,
    lastActivityAt: progress?.last_activity_at || null,
    resumeLessonId: resume?.lesson_id || null,
  };
}

async function getAllRows(queryFactory, operation) {
  const rows = [];
  for (let page = 0; page < MAX_QUERY_PAGES; page += 1) {
    const start = page * QUERY_PAGE_SIZE;
    const batch = await execute(
      operation,
      queryFactory().range(start, start + QUERY_PAGE_SIZE - 1),
    );
    rows.push(...batch);
    if (batch.length < QUERY_PAGE_SIZE) return rows;
  }

  throw new Error(`${operation} exceeds the supported reporting range.`);
}

async function getAllStudentEnrollments(client, studentId) {
  return getAllRows(
    () =>
      client
        .from("enrollments")
        .select("id,status,enrolled_at,course_id")
        .eq("student_id", studentId)
        .in("status", ["ACTIVE", "COMPLETED"])
        .order("enrolled_at", { ascending: false }),
    "load enrolled courses",
  );
}

async function attachCourses(client, enrollments) {
  const courseIds = [...new Set(enrollments.map((row) => row.course_id))];
  if (!courseIds.length) return [];

  const courses = [];
  for (let offset = 0; offset < courseIds.length; offset += 100) {
    const batch = await execute(
      "load enrolled course details",
      client
        .from("courses")
        .select(
          "id,title,slug,short_description,thumbnail_url,estimated_duration_minutes,instructor_id",
        )
        .in("id", courseIds.slice(offset, offset + 100)),
    );
    courses.push(...batch);
  }

  const courseById = new Map(courses.map((course) => [course.id, course]));
  return enrollments
    .map((enrollment) => ({
      ...enrollment,
      course: courseById.get(enrollment.course_id) || null,
    }))
    .filter((enrollment) => enrollment.course);
}

function sortEnrollmentsByActivity(enrollments, progressRows) {
  const progressByCourse = new Map(
    progressRows.map((row) => [row.course_id, row]),
  );
  return [...enrollments].sort((left, right) => {
    const leftAt =
      progressByCourse.get(left.course_id)?.last_activity_at || left.enrolled_at;
    const rightAt =
      progressByCourse.get(right.course_id)?.last_activity_at || right.enrolled_at;
    return new Date(rightAt).getTime() - new Date(leftAt).getTime();
  });
}

async function formatCourses(client, enrollments, progressRows) {
  const progressByCourse = new Map(
    progressRows.map((row) => [row.course_id, row]),
  );
  const resumeRows = await execute(
    "load lesson resume positions",
    client.rpc("get_student_course_resume"),
  );
  const resumeByCourse = new Map(
    resumeRows.map((row) => [row.course_id, row]),
  );
  const courseRows = enrollments
    .map((enrollment) =>
      Array.isArray(enrollment.course) ? enrollment.course[0] : enrollment.course,
    )
    .filter(Boolean);
  const instructors = await getPublicInstructorProfiles(
    client,
    courseRows.map((course) => course.instructor_id),
  );

  return enrollments
    .map((enrollment) =>
      toCourseCard(enrollment, progressByCourse, resumeByCourse, instructors),
    )
    .filter(Boolean);
}

async function getQuizAttempts(client, studentId) {
  return getAllRows(
    () =>
      client
        .from("quiz_attempts")
        .select("id,quiz_id,score,total_points,status,submitted_at,created_at")
        .eq("student_id", studentId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false }),
    "load quiz results",
  );
}

function calculateQuizAverage(attempts) {
  const graded = attempts.filter(
    (attempt) =>
      attempt.status === "GRADED" &&
      Number(attempt.total_points) > 0 &&
      attempt.score !== null,
  );
  if (!graded.length) return null;

  return Math.round(
    graded.reduce(
      (sum, attempt) => sum + (Number(attempt.score) / Number(attempt.total_points)) * 100,
      0,
    ) / graded.length,
  );
}

async function getActivityRows(client, offset = 0, limit = 5, type = null) {
  const rows = await execute(
    "load learning activity",
    client.rpc("get_student_learning_activity", {
      target_offset: offset,
      target_limit: limit,
      requested_type: type,
    }),
  );

  return {
    rows: rows || [],
    count: Number(rows?.[0]?.total_count || 0),
  };
}

async function getStreak(client, timeZone) {
  const rows = await execute(
    "calculate learning streak",
    client.rpc("get_student_learning_streak", {
      target_timezone: timeZone,
    }),
  );
  return rows?.[0] || { current_streak: 0, longest_streak: 0 };
}

async function getExactCount(client, table, column, studentId, filters = []) {
  let request = client
    .from(table)
    .select(column, { count: "exact", head: true })
    .eq("student_id", studentId);
  for (const [operator, name, value] of filters) {
    request = request[operator](name, value);
  }

  const { count, error } = await request;
  if (error) {
    logDatabaseError(`count ${table} rows`, error);
    throw new Error("Student learning metrics could not be loaded.");
  }
  return count || 0;
}

export async function getStudentDashboardData() {
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const { profile, goals } = await getProfileAndGoals(client, identity);
  const [
    enrollments,
    courseProgress,
    attempts,
    certificateCount,
    unreadCount,
    activity,
    streak,
  ] = await Promise.all([
    getAllStudentEnrollments(client, identity.id),
    getCourseProgress(client),
    getQuizAttempts(client, identity.id),
    getExactCount(client, "certificates", "id", identity.id, [
      ["eq", "status", "ISSUED"],
    ]),
    getUnreadNotificationCount(client, identity.id),
    getActivityRows(client),
    getStreak(client, goals.timezone),
  ]);

  const joinedEnrollments = await attachCourses(client, enrollments);
  const recentEnrollments = sortEnrollmentsByActivity(
    joinedEnrollments,
    courseProgress,
  ).slice(0, 8);
  const courses = await formatCourses(client, recentEnrollments, courseProgress);
  const totalLessons = courseProgress.reduce(
    (sum, course) => sum + Number(course.total_lessons || 0),
    0,
  );
  const completedLessons = courseProgress.reduce(
    (sum, course) => sum + Number(course.completed_lessons || 0),
    0,
  );
  const recentlyActiveCourses = [...courses]
    .sort(
      (left, right) =>
        new Date(right.lastActivityAt || right.enrolledAt).getTime() -
        new Date(left.lastActivityAt || left.enrolledAt).getTime(),
    )
    .slice(0, 4);
  const todayKey = getLocalDateKey(new Date(), goals.timezone);
  const weekStartKey = getWeekStartKey(todayKey);
  const [todayCompletedLessons, weeklyCompletedLessons] = await Promise.all([
    getCompletedLessonsInRange(
      client,
      identity.id,
      getLocalDayStart(todayKey, goals.timezone),
      getLocalDayStart(addCalendarDays(todayKey, 1), goals.timezone),
    ),
    getCompletedLessonsInRange(
      client,
      identity.id,
      getLocalDayStart(weekStartKey, goals.timezone),
      getLocalDayStart(addCalendarDays(todayKey, 1), goals.timezone),
    ),
  ]);

  return {
    profile,
    goals,
    enrolledCourseCount: enrollments.length,
    completedLessons,
    totalLessons,
    overallProgress: totalLessons
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0,
    quizAverage: calculateQuizAverage(attempts),
    quizAttemptCount: attempts.length,
    certificateCount,
    currentStreak: Number(streak.current_streak || 0),
    todayCompletedLessons,
    weeklyCompletedLessons,
    courses: recentlyActiveCourses,
    activity: activity.rows,
    unreadCount,
  };
}

async function getCompletedLessonsInRange(client, studentId, start, end) {
  const { count, error } = await client
    .from("lesson_progress")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "COMPLETED")
    .gte("completed_at", start.toISOString())
    .lt("completed_at", end.toISOString());

  if (error) {
    logDatabaseError("count completed lessons for the goal period", error);
    throw new Error("Learning goal progress could not be loaded.");
  }
  return count || 0;
}

async function getGoalCounts(client, identity, goals, now = new Date()) {
  const todayKey = getLocalDateKey(now, goals.timezone);
  const weekStart = getWeekStartKey(todayKey);
  const [today, week, streak] = await Promise.all([
    getCompletedLessonsInRange(
      client,
      identity.id,
      getLocalDayStart(todayKey, goals.timezone),
      getLocalDayStart(addCalendarDays(todayKey, 1), goals.timezone),
    ),
    getCompletedLessonsInRange(
      client,
      identity.id,
      getLocalDayStart(weekStart, goals.timezone),
      getLocalDayStart(addCalendarDays(todayKey, 1), goals.timezone),
    ),
    getStreak(client, goals.timezone),
  ]);

  return {
    today,
    week,
    streak: Number(streak.current_streak || 0),
    longestStreak: Number(streak.longest_streak || 0),
    todayKey,
  };
}

export async function getStudentGoalsPageData() {
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const { profile, goals } = await getProfileAndGoals(client, identity);
  const counts = await getGoalCounts(client, identity, goals);
  return { profile, goals, ...counts };
}

export async function getStudentCourseLibrary({
  page = 1,
  status = "all",
  query = "",
} = {}) {
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const [enrollments, progress] = await Promise.all([
    getAllStudentEnrollments(client, identity.id),
    getCourseProgress(client),
  ]);
  const joined = await attachCourses(client, enrollments);
  const normalizedStatus = ["ACTIVE", "COMPLETED"].includes(status)
    ? status
    : "all";
  const normalizedQuery = String(query || "").trim().slice(0, 80).toLocaleLowerCase();
  const filtered = sortEnrollmentsByActivity(joined, progress).filter(
    (enrollment) => {
      if (normalizedStatus !== "all" && enrollment.status !== normalizedStatus) {
        return false;
      }
      return !normalizedQuery ||
        enrollment.course.title.toLocaleLowerCase().includes(normalizedQuery);
    },
  );
  const safePage = Math.max(1, Math.min(10000, Number(page) || 1));
  const start = (safePage - 1) * COURSE_PAGE_SIZE;
  const courses = await formatCourses(
    client,
    filtered.slice(start, start + COURSE_PAGE_SIZE),
    progress,
  );

  return {
    courses,
    page: safePage,
    pageSize: COURSE_PAGE_SIZE,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / COURSE_PAGE_SIZE)),
    status: normalizedStatus,
    query: String(query || "").slice(0, 80),
  };
}

export async function getStudentProgressPageData(range = 30) {
  const safeRange = [7, 30, 90].includes(Number(range)) ? Number(range) : 30;
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const { profile, goals } = await getProfileAndGoals(client, identity);
  const [courseProgress, attempts, streak] = await Promise.all([
    getCourseProgress(client),
    getQuizAttempts(client, identity.id),
    getStreak(client, goals.timezone),
  ]);

  const [chart, enrollments] = await Promise.all([
    getStudentDailyChartData(client, identity, goals, safeRange),
    getAllStudentEnrollments(client, identity.id),
  ]);

  const totalLessons = courseProgress.reduce(
    (sum, course) => sum + Number(course.total_lessons || 0),
    0,
  );
  const completedLessons = courseProgress.reduce(
    (sum, course) => sum + Number(course.completed_lessons || 0),
    0,
  );
  const joinedEnrollments = await attachCourses(client, enrollments);
  const recentEnrollments = sortEnrollmentsByActivity(
    joinedEnrollments,
    courseProgress,
  ).slice(0, 20);
  const courses = await formatCourses(client, recentEnrollments, courseProgress);

  return {
    profile,
    goals,
    courseProgress,
    courses,
    chart,
    range: safeRange,
    totalLessons,
    completedLessons,
    overallProgress: totalLessons
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0,
    quizAverage: calculateQuizAverage(attempts),
    quizAttemptCount: attempts.length,
    currentStreak: Number(streak.current_streak || 0),
    longestStreak: Number(streak.longest_streak || 0),
  };
}

export async function getStudentActivityPageData({
  page = 1,
  type = "all",
} = {}) {
  const pageNumber = Math.max(1, Math.min(501, Number(page) || 1));
  const allowedTypes = new Set([
    "COURSE_ENROLLED",
    "LESSON_STARTED",
    "LESSON_COMPLETED",
    "QUIZ_ATTEMPTED",
    "QUIZ_PASSED",
    "CERTIFICATE_EARNED",
  ]);
  const filter = allowedTypes.has(type) ? type : "all";
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const [profile, goals, activity] = await Promise.all([
    getProfile(client, identity),
    getGoals(client, identity.id),
    getActivityRows(
      client,
      (pageNumber - 1) * ACTIVITY_PAGE_SIZE,
      ACTIVITY_PAGE_SIZE,
      filter === "all" ? null : filter,
    ),
  ]);

  return {
    profile,
    goals,
    activities: activity.rows,
    total: activity.count,
    page: pageNumber,
    pageSize: ACTIVITY_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(activity.count / ACTIVITY_PAGE_SIZE)),
    type: filter,
  };
}

export async function getStudentNotificationsPageData({ page = 1, unreadOnly = false } = {}) {
  const pageNumber = Math.max(1, Math.min(10000, Number(page) || 1));
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const [profile, goals, unreadCount, result] = await Promise.all([
    getProfile(client, identity),
    getGoals(client, identity.id),
    getUnreadNotificationCount(client, identity.id),
    (async () => {
      let request = client
        .from("notifications")
        .select("id,title,message,notification_type,target_url,is_read,read_at,created_at", {
          count: "exact",
        })
        .eq("user_id", identity.id)
        .order("created_at", { ascending: false });
      if (unreadOnly) request = request.eq("is_read", false);
      const { data, count, error } = await request.range(
        (pageNumber - 1) * ACTIVITY_PAGE_SIZE,
        pageNumber * ACTIVITY_PAGE_SIZE - 1,
      );
      if (error) {
        logDatabaseError("load notifications", error);
        throw new Error("Student notifications could not be loaded.");
      }
      return { rows: data || [], count: count || 0 };
    })(),
  ]);

  return {
    profile,
    goals,
    notifications: result.rows,
    total: result.count,
    unreadCount,
    unreadOnly,
    page: pageNumber,
    totalPages: Math.max(1, Math.ceil(result.count / ACTIVITY_PAGE_SIZE)),
  };
}

export async function getStudentAchievementsPageData() {
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const [profile, goals, certificateRows, completedRows] = await Promise.all([
    getProfile(client, identity),
    getGoals(client, identity.id),
    execute(
      "load earned certificates",
      client
        .from("certificates")
        .select(
          "id,course_id,enrollment_id,certificate_number,verification_code,issued_at,status,revoked_at,course:courses!inner(id,title,slug)",
        )
        .eq("student_id", identity.id)
        .order("issued_at", { ascending: false }),
    ),
    execute(
      "load completed courses",
      client
        .from("enrollments")
        .select("id,course_id,updated_at,course:courses!inner(id,title,slug)")
        .eq("student_id", identity.id)
        .eq("status", "COMPLETED")
        .order("updated_at", { ascending: false }),
    ),
  ]);

  const issuedCertificates = certificateRows.filter(
    (certificate) => certificate.status === "ISSUED",
  );
  const certificates = issuedCertificates.map((certificate) => {
    const course = Array.isArray(certificate.course)
      ? certificate.course[0]
      : certificate.course;
    return {
      ...certificate,
      course,
      downloadUrl: `/api/student/certificates/${certificate.id}`,
    };
  });
  const certificateByEnrollment = new Map(
    certificateRows.map((certificate) => [certificate.enrollment_id, certificate]),
  );
  const completedCourses = await Promise.all(
    completedRows.map(async (row) => {
      const eligibility = await execute(
        "check certificate eligibility",
        client.rpc("get_course_certificate_eligibility", {
          target_enrollment_id: row.id,
        }),
      );
      return {
        ...row,
        course: Array.isArray(row.course) ? row.course[0] : row.course,
        certificateIssued: certificateByEnrollment.get(row.id)?.status === "ISSUED",
        revokedCertificate:
          certificateByEnrollment.get(row.id)?.status === "REVOKED"
            ? {
                certificate_number:
                  certificateByEnrollment.get(row.id).certificate_number,
                verification_code:
                  certificateByEnrollment.get(row.id).verification_code,
                issued_at: certificateByEnrollment.get(row.id).issued_at,
                revoked_at: certificateByEnrollment.get(row.id).revoked_at,
              }
            : null,
        eligibility,
      };
    }),
  );

  return {
    profile,
    goals,
    certificates,
    completedCourses: completedCourses.filter((row) => row.course),
  };
}

export async function getStudentNotificationPreferences() {
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const preference = await execute(
    "load notification preferences",
    client
      .from("notification_preferences")
      .select(
        "course_updates,assessment_updates,certificate_updates,live_class_updates,billing_updates",
      )
      .eq("user_id", identity.id)
      .maybeSingle(),
  );
  return (
    preference || {
      course_updates: true,
      assessment_updates: true,
      certificate_updates: true,
      live_class_updates: true,
      billing_updates: true,
    }
  );
}

export async function getStudentProfilePageData() {
  const [identity, client] = await Promise.all([getStudentIdentity(), getClient()]);
  const { profile, goals } = await getProfileAndGoals(client, identity);
  return { identity, profile, goals };
}

export async function getStudentSettingsPageData() {
  return getStudentProfilePageData();
}

export async function getStudentDailyChartData(client, identity, goals, range = 7) {
  const dateKeys = getDateKeysEndingToday(range, goals.timezone);
  const rangeStart = getLocalDayStart(dateKeys[0], goals.timezone).toISOString();
  const [lessonRows, quizRows] = await Promise.all([
    getAllRows(
      () =>
        client
        .from("lesson_progress")
        .select("completed_at")
        .eq("student_id", identity.id)
        .eq("status", "COMPLETED")
        .gte("completed_at", rangeStart)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: true }),
      "load completed lessons for the learning chart",
    ),
    getAllRows(
      () =>
        client
        .from("quiz_attempts")
        .select("submitted_at")
        .eq("student_id", identity.id)
        .not("submitted_at", "is", null)
        .gte("submitted_at", rangeStart)
        .order("submitted_at", { ascending: true }),
      "load submitted quizzes for the learning chart",
    ),
  ]);

  const chart = new Map(
    dateKeys.map((date) => [date, { date, lessons: 0, quizzes: 0 }]),
  );
  for (const row of lessonRows) {
    const key = getLocalDateKey(new Date(row.completed_at), goals.timezone);
    if (chart.has(key)) chart.get(key).lessons += 1;
  }
  for (const row of quizRows) {
    const key = getLocalDateKey(new Date(row.submitted_at), goals.timezone);
    if (chart.has(key)) chart.get(key).quizzes += 1;
  }
  return [...chart.values()];
}
