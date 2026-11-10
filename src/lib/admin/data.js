import "server-only";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 30;

function logAdminReadFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

async function read(operation, query) {
  const { data, error } = await query;
  if (error) {
    logAdminReadFailure(operation, error);
    throw new Error(`The administrator workspace could not load ${operation}.`);
  }
  return data;
}

async function readCount(operation, query) {
  const { count, error } = await query;
  if (error) {
    logAdminReadFailure(operation, error);
    throw new Error(`The administrator workspace could not load ${operation}.`);
  }
  return count || 0;
}

async function getAdminContext() {
  const [identity, client] = await Promise.all([
    requireRole("admin"),
    createClient({ allowCookieWrites: false }),
  ]);
  return {
    identity: {
      id: identity.user.id,
      email: identity.user.email || "",
      fullName: identity.fullName || "",
    },
    client,
  };
}

function pageNumber(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function safeSearch(value) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}

function listParams(searchParams, allowedFilters) {
  return {
    search: safeSearch(searchParams?.q),
    page: pageNumber(searchParams?.page),
    filters: Object.fromEntries(
      allowedFilters.map((key) => [key, typeof searchParams?.[key] === "string" ? searchParams[key].slice(0, 100) : ""]),
    ),
  };
}

export async function getAdminProfile() {
  const { identity, client } = await getAdminContext();
  const profile = await read(
    "your administrator profile",
    client
      .from("profiles")
      .select("id,full_name,avatar_url,created_at")
      .eq("id", identity.id)
      .single(),
  );
  return { identity, profile: { ...profile, email: identity.email } };
}

export async function getAdminDashboardData() {
  const { identity, client } = await getAdminContext();
  const data = await read(
    "platform overview",
    client.rpc("admin_get_dashboard_data"),
  );
  return { identity, ...data };
}

export async function getAdminReports(searchParams = {}) {
  const { client } = await getAdminContext();
  const months = Number(searchParams.months);
  const reportMonths = Number.isInteger(months) && months >= 1 && months <= 24 ? months : 12;
  return read(
    "platform reports",
    client.rpc("admin_get_report_data", { report_months: reportMonths }),
  );
}

export async function getAdminUsers(searchParams = {}, roleFilter = "") {
  const { client } = await getAdminContext();
  const { search, page, filters } = listParams(searchParams, ["role"]);
  const requestedRole = roleFilter || filters.role;
  const role = ["student", "instructor", "admin"].includes(requestedRole) ? requestedRole : "";
  const users = await read(
    "user directory",
    client.rpc("admin_list_profiles", {
      search_term: search,
      role_filter: role,
      page_limit: PAGE_SIZE,
      page_offset: (page - 1) * PAGE_SIZE,
    }),
  );
  return {
    users,
    search,
    role,
    page,
    pageSize: PAGE_SIZE,
    total: Number(users[0]?.total_count || 0),
  };
}

export async function getAdminUser(userId) {
  if (!UUID_PATTERN.test(userId || "")) notFound();
  const { client } = await getAdminContext();
  const profile = await read(
    "the selected user",
    client.from("profiles")
      .select("id,full_name,email,avatar_url,role,created_at,updated_at")
      .eq("id", userId)
      .maybeSingle(),
  );
  if (!profile) notFound();
  const [enrollments, courses] = await Promise.all([
    read(
      "the user's enrollment history",
      client.from("enrollments")
        .select("id,course_id,status,enrollment_type,enrolled_at,expires_at,courses(id,title,status,instructor_id)")
        .eq("student_id", userId)
        .order("enrolled_at", { ascending: false })
        .limit(100),
    ),
    profile.role === "instructor"
      ? read(
          "the instructor's courses",
          client.from("courses")
            .select("id,title,status,language,difficulty,updated_at")
            .eq("instructor_id", userId)
            .order("updated_at", { ascending: false })
            .limit(100),
        )
      : [],
  ]);
  return { profile, enrollments, courses };
}

export async function getAdminCourses(searchParams = {}) {
  const { client } = await getAdminContext();
  const { search, page, filters } = listParams(searchParams, ["status", "category", "difficulty", "language"]);
  const status = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED"].includes(filters.status)
    ? filters.status
    : "";
  const difficulty = ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(filters.difficulty)
    ? filters.difficulty
    : "";
  const language = filters.language.slice(0, 80);
  const categoryId = filters.category && UUID_PATTERN.test(filters.category)
    ? filters.category
    : null;
  const result = await read(
    "course directory",
    client.rpc("admin_list_courses", {
      search_term: search,
      status_filter: status,
      category_filter: categoryId,
      difficulty_filter: difficulty,
      language_filter: language,
      page_limit: PAGE_SIZE,
      page_offset: (page - 1) * PAGE_SIZE,
    }),
  );
  const [categories, languageRows] = await Promise.all([
    read(
      "course categories",
      client.from("course_categories").select("id,name").order("name"),
    ),
    read(
      "course languages",
      client.from("courses").select("language").order("language").limit(1000),
    ),
  ]);
  return {
    courses: result,
    categories,
    search,
    status,
    category: categoryId || "",
    difficulty,
    language,
    languages: [...new Set(languageRows.map((row) => row.language))],
    page,
    pageSize: PAGE_SIZE,
    total: Number(result[0]?.total_count || 0),
  };
}

export async function getAdminCourse(courseId) {
  if (!UUID_PATTERN.test(courseId || "")) notFound();
  const { client } = await getAdminContext();
  const course = await read(
    "the selected course",
    client.from("courses")
      .select("id,instructor_id,category_id,title,slug,short_description,description,learning_outcomes,prerequisites,target_audience,language,difficulty,thumbnail_url,price_cents,currency,estimated_duration_minutes,status,published_at,created_at,updated_at")
      .eq("id", courseId)
      .maybeSingle(),
  );
  if (!course) notFound();
  const [instructor, category, sections, assessments, enrollmentCount, history] = await Promise.all([
    read(
      "course instructor",
      client.from("profiles").select("id,full_name,email").eq("id", course.instructor_id).maybeSingle(),
    ),
    course.category_id
      ? read(
          "course category",
          client.from("course_categories").select("id,name").eq("id", course.category_id).maybeSingle(),
        )
      : null,
    read(
      "course curriculum",
      client.from("course_sections")
        .select("id,title,description,position,lessons(id,title,description,content_type,duration_seconds,position,is_preview,is_published,lesson_resources(id,title,resource_type,external_url))")
        .eq("course_id", courseId)
        .order("position"),
    ),
    read(
      "course assessments",
      client.from("quizzes").select("id,title,assessment_type,is_published,created_at")
        .eq("course_id", courseId).order("created_at", { ascending: false }),
    ),
    readCount(
      "course enrollment count",
      client.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    ),
    read(
      "course moderation history",
      client.from("admin_audit_logs").select("id,administrator_id,action,reason,metadata,created_at")
        .eq("entity_type", "course").eq("entity_id", courseId)
        .order("created_at", { ascending: false }).limit(20),
    ),
  ]);
  return {
    course,
    instructor,
    category,
    sections,
    assessments,
    enrollmentCount,
    history,
  };
}

export async function getAdminInstructors(searchParams = {}) {
  const result = await getAdminUsers(searchParams, "instructor");
  const { client } = await getAdminContext();
  const instructors = await Promise.all(result.users.map(async (user) => {
    const { count, error } = await client.from("courses")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", user.id);
    if (error) {
      logAdminReadFailure("instructor course counts", error);
      throw new Error("The administrator workspace could not load instructor courses.");
    }
    return { ...user, courseCount: count || 0 };
  }));
  return { ...result, users: instructors };
}

export async function getAdminCategories() {
  const { client } = await getAdminContext();
  const categories = await read(
    "category directory",
    client.from("course_categories")
      .select("id,name,slug,description,image_url,is_active,created_at,updated_at")
      .order("name"),
  );
  const withCounts = await Promise.all(categories.map(async (category) => {
    const { data: courses, count, error } = await client.from("courses")
      .select("id,title,status", { count: "exact" })
      .eq("category_id", category.id)
      .order("title")
      .range(0, 19);
    if (error) {
      logAdminReadFailure("category course counts", error);
      throw new Error("The administrator workspace could not load category usage.");
    }
    return { ...category, courseCount: count || 0, courses };
  }));
  return withCounts;
}

export async function getAdminAssessments(searchParams = {}) {
  const { client } = await getAdminContext();
  const { search, page, filters } = listParams(searchParams, ["publication"]);
  const publication = ["published", "unpublished"].includes(filters.publication)
    ? filters.publication
    : "";
  const result = await read(
    "assessment directory",
    client.rpc("admin_list_assessments", {
      search_term: search,
      publication_filter: publication,
      page_limit: PAGE_SIZE,
      page_offset: (page - 1) * PAGE_SIZE,
    }),
  );
  return {
    assessments: result,
    search,
    publication,
    page,
    pageSize: PAGE_SIZE,
    total: Number(result[0]?.total_count || 0),
  };
}

export async function getAdminAssessment(assessmentId, searchParams = {}) {
  if (!UUID_PATTERN.test(assessmentId || "")) notFound();
  const { client } = await getAdminContext();
  const attemptPage = pageNumber(searchParams?.page);
  const attemptPageSize = 50;
  const assessment = await read(
    "the selected assessment",
    client.from("quizzes")
      .select("id,course_id,lesson_id,title,description,instructions,assessment_type,time_limit_seconds,passing_score,maximum_attempts,is_published,available_from,available_until,randomize_questions,randomize_options,allow_partial_credit,negative_marking,allow_result_review,show_correct_answers,show_explanations,allow_concurrent_attempts,created_at")
      .eq("id", assessmentId)
      .maybeSingle(),
  );
  if (!assessment) notFound();
  const [course, participation, history, attempts] = await Promise.all([
    read(
      "assessment course",
      client.from("courses").select("id,title,status,instructor_id").eq("id", assessment.course_id).maybeSingle(),
    ),
    read(
      "assessment participation",
      client.rpc("admin_get_assessment_stats", { target_assessment_id: assessmentId }),
    ),
    read(
      "assessment moderation history",
      client.from("admin_audit_logs").select("id,administrator_id,action,reason,metadata,created_at")
        .eq("entity_type", "assessment").eq("entity_id", assessmentId)
        .order("created_at", { ascending: false }).limit(20),
    ),
    read(
      "assessment attempts for manual review",
      client.rpc("admin_list_assessment_attempts", {
        target_assessment_id: assessmentId,
        page_limit: attemptPageSize,
        page_offset: (attemptPage - 1) * attemptPageSize,
      }),
    ),
  ]);
  const reviewEvents = attempts.length
    ? await read(
        "assessment attempt review history",
        client
          .from("assessment_attempt_review_events")
          .select("id,attempt_id,review_status,review_note,created_at")
          .in("attempt_id", attempts.map((attempt) => attempt.attempt_id))
          .order("created_at", { ascending: false }),
      )
    : [];
  const reviewEventsByAttempt = new Map();
  for (const event of reviewEvents) {
    const previous = reviewEventsByAttempt.get(event.attempt_id) || [];
    previous.push(event);
    reviewEventsByAttempt.set(event.attempt_id, previous);
  }
  return {
    assessment,
    course,
    participation: {
      attempts: participation.attempts,
      graded: participation.graded,
      averagePercent: participation.average_percent,
    },
    attempts: attempts.map((attempt) => ({
      ...attempt,
      reviewHistory: reviewEventsByAttempt.get(attempt.attempt_id) || [],
    })),
    attemptPage,
    attemptPageSize,
    attemptTotal: Number(participation.attempts || 0),
    history,
  };
}

export async function getAdminActivity(searchParams = {}) {
  const { client } = await getAdminContext();
  const { search, page, filters } = listParams(searchParams, ["entity"]);
  let query = client.from("admin_audit_logs")
    .select("id,administrator_id,action,entity_type,entity_id,reason,metadata,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (search) query = query.ilike("action", `%${search}%`);
  if (filters.entity) query = query.eq("entity_type", filters.entity);
  const { data: logs, error, count } = await query;
  if (error) {
    logAdminReadFailure("administrative audit history", error);
    throw new Error("The administrator workspace could not load administrative audit history.");
  }
  const ids = [...new Set(logs.map((log) => log.administrator_id).filter(Boolean))];
  const admins = ids.length
    ? await read("administrator names", client.from("profiles").select("id,full_name").in("id", ids))
    : [];
  const names = new Map(admins.map((profile) => [profile.id, profile.full_name]));
  return {
    logs: logs.map((log) => ({ ...log, administratorName: names.get(log.administrator_id) || "Former administrator" })),
    search,
    entity: filters.entity,
    page,
    pageSize: PAGE_SIZE,
    total: count || 0,
  };
}

export async function getAdminSettings() {
  const { client } = await getAdminContext();
  return read(
    "platform settings",
    client.from("platform_settings")
      .select("setting_key,setting_value,description,is_public,updated_by,updated_at")
      .order("setting_key"),
  );
}
