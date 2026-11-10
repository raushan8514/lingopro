"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(["student", "instructor", "admin"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SETTING_KEY_PATTERN = /^[a-z][a-z0-9_.-]{1,99}$/;
const SECRET_KEY_PATTERN =
  /(^|[_.-])(api.?key|access.?key|secret|token|password|credential|dsn|connection.?string)([_.-]|$)/i;
const BILLING_KEY_PATTERN = /(^|[_.-])(payment|payments|billing|razorpay|stripe)([_.-]|$)/i;

function text(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function logAdminMutation(operation, error) {
  console.error(`Unable to ${operation}.`, {
    name: error?.name,
    status: error?.status,
    code: error?.code,
  });
}

function mutationFailure(operation, error, message) {
  logAdminMutation(operation, error);
  return { error: message };
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/instructors");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/assessments");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/activity");
  revalidatePath("/admin/settings");
}

export async function setAdminUserRole(_previousState, formData) {
  const auth = await requireRole("admin");
  const userId = text(formData, "user_id");
  const role = text(formData, "role");
  if (!UUID_PATTERN.test(userId) || !ROLES.has(role)) {
    return { error: "Choose a valid user and account role." };
  }
  if (userId === auth.user.id) {
    return { error: "You cannot change your own administrator role." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_user_role", {
      target_user_id: userId,
      new_role: role,
    });
    if (error) {
      return mutationFailure(
        "update the user role",
        error,
        "The role could not be updated. Check access and try again.",
      );
    }
  } catch (requestError) {
    return mutationFailure(
      "reach Supabase to update the user role",
      requestError,
      "The role could not be updated. Check access and try again.",
    );
  }

  revalidateAdmin();
  revalidatePath("/student");
  revalidatePath("/instructor");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath(`/admin/instructors/${userId}`);
  return { success: "The account role was updated." };
}

export async function moderateAdminCourse(_previousState, formData) {
  await requireRole("admin");
  const courseId = text(formData, "course_id");
  const action = text(formData, "moderation_action");
  const reason = text(formData, "reason");
  if (!UUID_PATTERN.test(courseId) || !["publish", "return", "archive", "restore"].includes(action)) {
    return { error: "Choose a valid course moderation action." };
  }
  if (reason.length < 3 || reason.length > 1000) {
    return { error: "Provide a moderation reason between 3 and 1,000 characters." };
  }

  try {
    const client = await createClient();
    const { error } = await client.rpc("admin_moderate_course", {
      target_course_id: courseId,
      moderation_action: action,
      moderation_reason: reason,
    });
    if (error) {
      return mutationFailure("moderate the course", error, error.message || "The course could not be moderated.");
    }
  } catch (error) {
    return mutationFailure("reach Supabase to moderate the course", error, "The course could not be moderated.");
  }
  revalidateAdmin();
  revalidatePath("/");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  return { success: "The course moderation decision was recorded." };
}

export async function unpublishAdminAssessment(_previousState, formData) {
  await requireRole("admin");
  const assessmentId = text(formData, "assessment_id");
  const reason = text(formData, "reason");
  if (!UUID_PATTERN.test(assessmentId)) return { error: "The assessment identifier is invalid." };
  if (reason.length < 3 || reason.length > 1000) {
    return { error: "Provide a moderation reason between 3 and 1,000 characters." };
  }
  try {
    const client = await createClient();
    const { error } = await client.rpc("admin_unpublish_assessment", {
      target_assessment_id: assessmentId,
      moderation_reason: reason,
    });
    if (error) {
      return mutationFailure("unpublish the assessment", error, error.message || "The assessment could not be unpublished.");
    }
  } catch (error) {
    return mutationFailure("reach Supabase to moderate the assessment", error, "The assessment could not be unpublished.");
  }
  revalidateAdmin();
  revalidatePath(`/admin/assessments/${assessmentId}`);
  revalidatePath("/student/assessments");
  return { success: "The assessment was unpublished. Existing attempt records were preserved." };
}

export async function reviewAdminAssessmentAttempt(_previousState, formData) {
  await requireRole("admin");
  const attemptId = text(formData, "attempt_id");
  const assessmentId = text(formData, "assessment_id");
  const reviewStatus = text(formData, "review_status");
  const reason = text(formData, "review_note");
  if (![attemptId, assessmentId].every((id) => UUID_PATTERN.test(id))) {
    return { error: "The assessment attempt identifier is invalid." };
  }
  if (!["FLAGGED", "CLEARED"].includes(reviewStatus)) {
    return { error: "Choose whether to flag or clear this attempt." };
  }
  if (reason.length < 3 || reason.length > 1000) {
    return { error: "Provide a review note between 3 and 1,000 characters." };
  }

  const client = await createClient();
  const { error } = await client.rpc("admin_review_assessment_attempt", {
    target_attempt_id: attemptId,
    requested_status: reviewStatus,
    review_reason: reason,
  });
  if (error) {
    return mutationFailure(
      "record the assessment review",
      error,
      error.message || "The assessment review could not be recorded.",
    );
  }

  revalidateAdmin();
  revalidatePath(`/admin/assessments/${assessmentId}`);
  return { success: `The attempt was marked ${reviewStatus.toLowerCase()}.` };
}

export async function revokeAdminCertificate(_previousState, formData) {
  await requireRole("admin");
  const certificateId = text(formData, "certificate_id");
  const reason = text(formData, "reason");
  if (!UUID_PATTERN.test(certificateId)) {
    return { error: "The certificate identifier is invalid." };
  }
  if (reason.length < 10 || reason.length > 1000) {
    return { error: "Provide a revocation reason between 10 and 1,000 characters." };
  }

  const client = await createClient();
  const { error } = await client.rpc("revoke_course_certificate", {
    target_certificate_id: certificateId,
    revocation_reason: reason,
  });
  if (error) {
    return mutationFailure(
      "revoke the certificate",
      error,
      error.message || "The certificate could not be revoked.",
    );
  }

  revalidateAdmin();
  revalidatePath("/admin/certificates");
  revalidatePath("/student/achievements");
  return { success: "The certificate was revoked and the reason was recorded." };
}

export async function saveAdminCategory(_previousState, formData) {
  await requireRole("admin");
  const categoryId = text(formData, "category_id");
  const name = text(formData, "name");
  const slug = text(formData, "slug").toLowerCase();
  const description = text(formData, "description");
  const imageUrl = text(formData, "image_url");
  const active = formData.getAll("is_active").includes("true");
  if (categoryId && !UUID_PATTERN.test(categoryId)) return { error: "The category identifier is invalid." };
  if (name.length < 1 || name.length > 100) return { error: "Category names must be 1–100 characters." };
  if (!SLUG_PATTERN.test(slug) || slug.length > 100) return { error: "Use a unique lowercase slug with letters, numbers, and hyphens." };
  if (description.length > 2000) return { error: "The description cannot exceed 2,000 characters." };
  if (imageUrl.length > 2048) return { error: "The image URL is too long." };
  if (imageUrl) {
    try {
      const url = new URL(imageUrl);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid URL");
    } catch {
      return { error: "Category images must use a valid HTTPS URL." };
    }
  }

  try {
    const client = await createClient();
    const values = {
      name,
      slug,
      description: description || null,
      image_url: imageUrl || null,
      is_active: active,
    };
    const query = categoryId
      ? client.from("course_categories").update(values).eq("id", categoryId)
      : client.from("course_categories").insert(values);
    const { error } = await query;
    if (error) {
      return mutationFailure(
        "save the category",
        error,
        error.code === "23505" ? "That category slug is already in use." : "The category could not be saved.",
      );
    }
  } catch (error) {
    return mutationFailure("reach Supabase to save the category", error, "The category could not be saved.");
  }
  revalidateAdmin();
  revalidatePath("/categories");
  revalidatePath("/courses");
  return { success: "The category was saved. Categories in use should be deactivated rather than deleted." };
}

export async function saveAdminSetting(_previousState, formData) {
  const auth = await requireRole("admin");
  const key = text(formData, "setting_key").toLowerCase();
  const rawValue = text(formData, "setting_value");
  const description = text(formData, "description");
  const isPublic = formData.getAll("is_public").includes("true");
  if (!SETTING_KEY_PATTERN.test(key) || SECRET_KEY_PATTERN.test(key) || BILLING_KEY_PATTERN.test(key)) {
    return { error: "Use a safe setting key. Credential-like keys are not permitted." };
  }
  if (rawValue.length > 10000 || description.length > 500) {
    return { error: "The setting value or description is too long." };
  }
  let settingValue;
  try {
    settingValue = JSON.parse(rawValue);
  } catch {
    return { error: "Enter a valid JSON value." };
  }
  if (
    settingValue === undefined ||
    (typeof settingValue === "string" && settingValue.length > 5000) ||
    (typeof settingValue === "number" && !Number.isFinite(settingValue))
  ) {
    return { error: "The setting value is not supported or is too large." };
  }

  try {
    const client = await createClient();
    const { error } = await client.from("platform_settings").upsert({
      setting_key: key,
      setting_value: settingValue,
      description: description || null,
      is_public: isPublic,
      updated_by: auth.user.id,
    });
    if (error) {
      return mutationFailure(
        "save the platform setting",
        error,
        error.message || "The platform setting could not be saved.",
      );
    }
  } catch (error) {
    return mutationFailure("reach Supabase to save the platform setting", error, "The platform setting could not be saved.");
  }
  revalidateAdmin();
  return { success: "The setting was saved. Only settings explicitly read by the application affect runtime behavior." };
}
