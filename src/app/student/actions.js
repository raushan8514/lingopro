"use server";

import { revalidatePath } from "next/cache";
import { getStudentIdentity } from "@/lib/student/data";
import { isValidTimeZone } from "@/lib/student/time";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logMutationFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

export async function saveStudentProfile(previousState, formData) {
  const identity = await getStudentIdentity();
  const fullName = String(formData.get("full_name") || "").trim();

  if (fullName.length < 1 || fullName.length > 120) {
    return { error: "Enter a name between 1 and 120 characters." };
  }

  const client = await createClient();
  const { error } = await client
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", identity.id);

  if (error) {
    logMutationFailure("update the student profile", error);
    return { error: "Your profile could not be saved. Please try again." };
  }

  revalidatePath("/student");
  revalidatePath("/student/profile");
  revalidatePath("/student/settings");
  return { success: "Profile saved." };
}

export async function saveStudentLearningGoals(previousState, formData) {
  const identity = await getStudentIdentity();
  const dailyTarget = Number(formData.get("daily_lesson_target"));
  const weeklyTarget = Number(formData.get("weekly_lesson_target"));
  const timezone = String(formData.get("timezone") || "").trim();
  const preferredLanguage = String(formData.get("preferred_language") || "").trim();

  if (!Number.isInteger(dailyTarget) || dailyTarget < 1 || dailyTarget > 20) {
    return { error: "Your daily target must be between 1 and 20 lessons." };
  }
  if (!Number.isInteger(weeklyTarget) || weeklyTarget < 1 || weeklyTarget > 100) {
    return { error: "Your weekly target must be between 1 and 100 lessons." };
  }
  if (!isValidTimeZone(timezone)) {
    return { error: "Choose a valid timezone." };
  }
  if (preferredLanguage && (preferredLanguage.length < 2 || preferredLanguage.length > 80)) {
    return { error: "Preferred language must be between 2 and 80 characters." };
  }

  const client = await createClient();
  const { error } = await client
    .from("student_learning_goals")
    .upsert(
      {
        student_id: identity.id,
        daily_lesson_target: dailyTarget,
        weekly_lesson_target: weeklyTarget,
        timezone,
        preferred_language: preferredLanguage || null,
      },
      { onConflict: "student_id" },
    );

  if (error) {
    logMutationFailure("save student learning goals", error);
    return { error: "Your learning preferences could not be saved. Please try again." };
  }

  revalidatePath("/student");
  revalidatePath("/student/goals");
  revalidatePath("/student/progress");
  revalidatePath("/student/profile");
  revalidatePath("/student/settings");
  return { success: "Learning goals and preferences saved." };
}

export async function saveStudentAvatarPath(path) {
  const identity = await getStudentIdentity();
  const safePath = String(path || "");
  const expectedPrefix = `${identity.id}/profile-avatar.`;
  const allowedExtensions = ["jpg", "png", "webp"];
  const extension = safePath.startsWith(expectedPrefix)
    ? safePath.slice(expectedPrefix.length)
    : "";

  if (!allowedExtensions.includes(extension)) {
    return { error: "Choose a valid profile image and try again." };
  }

  const client = await createClient();
  const { error } = await client
    .from("profiles")
    .update({ avatar_path: safePath })
    .eq("id", identity.id);

  if (error) {
    logMutationFailure("save the private profile image path", error);
    return { error: "The uploaded image could not be linked to your profile." };
  }

  revalidatePath("/student");
  revalidatePath("/student/profile");
  revalidatePath("/student/settings");
  return { success: "Profile image updated." };
}

export async function markStudentNotificationRead(formData) {
  await getStudentIdentity();
  const notificationId = String(formData.get("notification_id") || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(notificationId)) {
    throw new Error("The notification identifier is invalid.");
  }

  const client = await createClient();
  const { error } = await client.rpc("mark_notification_read", {
    target_notification_id: notificationId,
  });
  if (error) {
    logMutationFailure("mark a notification as read", error);
    throw new Error("The notification could not be marked as read.");
  }

  revalidatePath("/student");
  revalidatePath("/student/notifications");
}

export async function markAllStudentNotificationsRead() {
  const identity = await getStudentIdentity();
  const client = await createClient();
  const { error } = await client
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", identity.id)
    .eq("is_read", false);

  if (error) {
    logMutationFailure("mark all notifications as read", error);
    throw new Error("Notifications could not be marked as read.");
  }

  revalidatePath("/student");
  revalidatePath("/student/notifications");
}

export async function saveStudentNotificationPreferences(_previousState, formData) {
  const identity = await getStudentIdentity();
  const preference = (name) => formData.getAll(name).includes("true");
  const client = await createClient();
  const { error } = await client.from("notification_preferences").upsert(
    {
      user_id: identity.id,
      course_updates: preference("course_updates"),
      assessment_updates: preference("assessment_updates"),
      certificate_updates: preference("certificate_updates"),
      live_class_updates: preference("live_class_updates"),
      billing_updates: preference("billing_updates"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    logMutationFailure("save student notification preferences", error);
    return { error: "Your notification preferences could not be saved." };
  }

  revalidatePath("/student/settings");
  return { success: "Notification preferences saved." };
}

export async function registerStudentForLiveClass(_previousState, formData) {
  await getStudentIdentity();
  const liveClassId = String(formData.get("live_class_id") || "");
  if (!UUID_PATTERN.test(liveClassId)) {
    return { error: "The live class identifier is invalid." };
  }

  const client = await createClient();
  const { error } = await client.rpc("register_for_live_class", {
    target_live_class_id: liveClassId,
  });
  if (error) {
    logMutationFailure("register for a live class", error);
    return {
      error:
        error.code === "23514" || error.code === "42501"
          ? error.message
          : "You could not be registered for this class. Please try again.",
    };
  }

  revalidatePath("/student/live-classes");
  revalidatePath("/student/notifications");
  return { success: "Your registration is confirmed." };
}

export async function cancelStudentLiveClassRegistration(_previousState, formData) {
  await getStudentIdentity();
  const liveClassId = String(formData.get("live_class_id") || "");
  if (!UUID_PATTERN.test(liveClassId)) {
    return { error: "The live class identifier is invalid." };
  }

  const client = await createClient();
  const { error } = await client.rpc("cancel_live_class_registration", {
    target_live_class_id: liveClassId,
  });
  if (error) {
    logMutationFailure("cancel a live class registration", error);
    return { error: "The registration could not be cancelled." };
  }
  revalidatePath("/student/live-classes");
  return { success: "Your registration was cancelled." };
}

export async function recordStudentLessonAccess(lessonId) {
  await getStudentIdentity();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(lessonId || ""),
    )
  ) {
    return { error: "This lesson is unavailable." };
  }

  const client = await createClient();
  const { error } = await client.rpc("record_lesson_access", {
    target_lesson_id: lessonId,
  });
  if (error) {
    logMutationFailure("record student lesson access", error);
    return { error: "Your lesson access could not be synchronized." };
  }
  return { success: true };
}

export async function saveStudentLessonPosition(lessonId, positionSeconds) {
  await getStudentIdentity();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(lessonId || ""),
    ) ||
    !Number.isInteger(positionSeconds) ||
    positionSeconds < 0 ||
    positionSeconds > 604800
  ) {
    return { error: "The playback position is invalid." };
  }

  const client = await createClient();
  const { error } = await client.rpc("record_lesson_playback_position", {
    target_lesson_id: lessonId,
    target_position_seconds: positionSeconds,
  });
  if (error) {
    logMutationFailure("save student lesson playback position", error);
    return {
      error:
        error.code === "42501"
          ? "This lesson is no longer available to your account."
          : "Playback progress could not be saved. Check your connection and try again.",
    };
  }
  return { success: true };
}

export async function completeStudentLesson(lessonId, completionSource = "MANUAL") {
  await getStudentIdentity();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(lessonId || ""),
    ) ||
    !["MANUAL", "MEDIA"].includes(completionSource)
  ) {
    return { error: "Lesson completion could not be verified." };
  }

  const client = await createClient();
  const { error } = await client.rpc("complete_lesson", {
    target_lesson_id: lessonId,
    completion_source: completionSource,
  });
  if (error) {
    logMutationFailure("complete student lesson", error);
    return {
      error:
        error.code === "42501"
          ? "This lesson is no longer available to your account."
          : error.code === "23514"
            ? "Continue the lesson before marking it complete."
            : "Lesson completion could not be saved. Please try again.",
    };
  }

  revalidatePath("/student");
  revalidatePath("/student/courses");
  revalidatePath("/student/progress");
  revalidatePath("/student/activity");
  revalidatePath("/student/achievements");
  revalidatePath("/student/courses/[courseId]/learn", "page");
  revalidatePath("/student/courses/[courseId]/learn/[lessonId]", "page");
  return { success: true };
}
