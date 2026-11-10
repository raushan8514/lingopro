import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const pageSize = 12;

function logCourseQueryFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    message: typeof error?.message === "string" ? error.message.slice(0, 500) : undefined,
  });
}

async function getClient() {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  try {
    return { status: "ready", client: await createClient({ allowCookieWrites: false }) };
  } catch (error) {
    unstable_rethrow(error);
    logCourseQueryFailure("connect to the course catalog", error);
    return { status: "unavailable" };
  }
}

export async function getMarketplaceCatalog(filters, instructorId = null) {
  const clientResult = await getClient();
  if (clientResult.status !== "ready") return { status: clientResult.status };

  const { client } = clientResult;
  const offset = (filters.page - 1) * pageSize;

  try {
    const [searchResult, categoryResult] = await Promise.all([
      client.rpc("search_published_courses", {
        p_search_term: filters.query || null,
        p_language: filters.language || null,
        p_difficulty: filters.difficulty || null,
        p_price: filters.price,
        p_category_id: filters.categoryId || null,
        p_sort: filters.sort,
        p_limit: pageSize,
        p_offset: offset,
        p_instructor_id: instructorId,
      }),
      client.rpc("get_public_course_categories"),
    ]);

    if (searchResult.error) {
      logCourseQueryFailure("search published courses", searchResult.error);
      return { status: "unavailable" };
    }

    if (categoryResult.error) {
      logCourseQueryFailure("load course categories", categoryResult.error);
      return { status: "unavailable" };
    }

    const result = searchResult.data || {};
    return {
      status: "ready",
      courses: Array.isArray(result.courses) ? result.courses : [],
      total: Number(result.total) || 0,
      languages: Array.isArray(result.languages) ? result.languages : [],
      categories: categoryResult.data || [],
      pageSize,
    };
  } catch (error) {
    logCourseQueryFailure("load the course catalog", error);
    return { status: "unavailable" };
  }
}

export const getPublicCourseCategories = cache(async function getPublicCourseCategories() {
  const clientResult = await getClient();
  if (clientResult.status !== "ready") return { status: clientResult.status };

  try {
    const { data, error } = await clientResult.client.rpc(
      "get_public_course_categories",
    );

    if (error) {
      logCourseQueryFailure("load public course categories", error);
      return { status: "unavailable" };
    }

    return { status: "ready", categories: data || [] };
  } catch (error) {
    logCourseQueryFailure("load public course categories", error);
    return { status: "unavailable" };
  }
});

export const getPublishedCourseBySlug = cache(async function getPublishedCourseBySlug(slug) {
  const clientResult = await getClient();
  if (clientResult.status !== "ready") return { status: clientResult.status };

  try {
    const { data, error } = await clientResult.client.rpc(
      "get_public_course_details",
      { target_slug: slug },
    );

    if (error) {
      logCourseQueryFailure("load published course details", error);
      return { status: "unavailable" };
    }

    return {
      status: "ready",
      course: data
        ? {
            ...data,
            category: data.category_name
              ? { name: data.category_name, slug: data.category_slug }
              : null,
          }
        : null,
    };
  } catch (error) {
    logCourseQueryFailure("load published course details", error);
    return { status: "unavailable" };
  }
});

export const getPublicInstructorProfile = cache(async function getPublicInstructorProfile(id) {
  const clientResult = await getClient();
  if (clientResult.status !== "ready") return { status: clientResult.status };

  try {
    const { data, error } = await clientResult.client.rpc(
      "get_public_instructor_profile",
      { target_instructor_id: id },
    );

    if (error) {
      logCourseQueryFailure("load the public instructor profile", error);
      return { status: "unavailable" };
    }

    return { status: "ready", instructor: data?.[0] || null };
  } catch (error) {
    logCourseQueryFailure("load the public instructor profile", error);
    return { status: "unavailable" };
  }
});

export const getPublicCourseCurriculum = cache(async function getPublicCourseCurriculum(courseId) {
  const clientResult = await getClient();
  if (clientResult.status !== "ready") return { status: clientResult.status };

  try {
    const { data, error } = await clientResult.client.rpc(
      "get_public_course_curriculum",
      { target_course_id: courseId },
    );

    if (error) {
      logCourseQueryFailure("load the public course curriculum", error);
      return { status: "unavailable" };
    }

    return { status: "ready", sections: Array.isArray(data) ? data : [] };
  } catch (error) {
    logCourseQueryFailure("load the public course curriculum", error);
    return { status: "unavailable" };
  }
});

export async function getInstructorCourses(instructorId, page = 1) {
  const clientResult = await getClient();
  if (clientResult.status !== "ready") return { status: clientResult.status };

  const safePage = Math.min(Math.max(Number(page) || 1, 1), 834);
  try {
    const { data, error } = await clientResult.client.rpc(
      "search_published_courses",
      {
        p_search_term: null,
        p_language: null,
        p_difficulty: null,
        p_price: "all",
        p_category_id: null,
        p_sort: "newest",
        p_limit: pageSize,
        p_offset: (safePage - 1) * pageSize,
        p_instructor_id: instructorId,
      },
    );

    if (error) {
      logCourseQueryFailure("load the instructor's published courses", error);
      return { status: "unavailable" };
    }

    return {
      status: "ready",
      courses: Array.isArray(data?.courses) ? data.courses : [],
      total: Number(data?.total) || 0,
      page: safePage,
      pageSize,
    };
  } catch (error) {
    logCourseQueryFailure("load the instructor's published courses", error);
    return { status: "unavailable" };
  }
}

export async function getCourseEnrollment(courseId, studentId) {
  const clientResult = await getClient();
  if (clientResult.status !== "ready") return { status: clientResult.status };

  try {
    const { data, error } = await clientResult.client
      .from("enrollments")
      .select("id, status")
      .eq("course_id", courseId)
      .eq("student_id", studentId)
      .in("status", ["ACTIVE", "COMPLETED"])
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logCourseQueryFailure("check the current course enrollment", error);
      return { status: "unavailable" };
    }

    return { status: "ready", enrollment: data || null };
  } catch (error) {
    logCourseQueryFailure("check the current course enrollment", error);
    return { status: "unavailable" };
  }
}

export function getCoursePageSize() {
  return pageSize;
}
