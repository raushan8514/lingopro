"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const PROVIDERS = new Set(["EXTERNAL", "ZOOM", "GOOGLE_MEET", "OTHER"]);

function text(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseUtcDatetime(value) {
  if (!UTC_DATETIME_PATTERN.test(value)) return new Date(Number.NaN);
  return new Date(`${value}:00Z`);
}

function logInstructorLiveClassFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

function revalidateLiveClassPages(liveClassId) {
  revalidatePath("/instructor/live-classes");
  revalidatePath("/student/live-classes");
  revalidatePath("/admin/live-classes");
  revalidatePath("/admin/activity");
  if (liveClassId) revalidatePath(`/instructor/live-classes/${liveClassId}`);
}

export async function createInstructorLiveClass(_previousState, formData) {
  const auth = await requireRole("instructor");
  const courseId = text(formData, "course_id");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const provider = text(formData, "meeting_provider");
  const meetingReference = text(formData, "meeting_reference");
  const scheduledStart = parseUtcDatetime(text(formData, "scheduled_start"));
  const scheduledEnd = parseUtcDatetime(text(formData, "scheduled_end"));
  const maxParticipantsText = text(formData, "max_participants");
  const maxParticipants = maxParticipantsText ? Number(maxParticipantsText) : null;

  if (!UUID_PATTERN.test(courseId)) return { error: "Choose a valid published course." };
  if (title.length < 1 || title.length > 180) {
    return { error: "Class titles must be between 1 and 180 characters." };
  }
  if (description.length > 2000) return { error: "The description is too long." };
  if (!PROVIDERS.has(provider)) return { error: "Choose a supported meeting provider." };
  if (meetingReference.length > 2048) return { error: "The meeting link is too long." };
  try {
    const url = new URL(meetingReference);
    if (url.protocol !== "https:" || url.username || url.password) {
      return { error: "Enter a valid HTTPS meeting link without embedded credentials." };
    }
  } catch {
    return { error: "Enter a valid HTTPS meeting link." };
  }
  if (
    Number.isNaN(scheduledStart.getTime()) ||
    Number.isNaN(scheduledEnd.getTime()) ||
    scheduledStart <= new Date() ||
    scheduledEnd <= scheduledStart
  ) {
    return { error: "Choose a future start and an end time after the start." };
  }
  if (
    maxParticipants !== null &&
    (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 1000)
  ) {
    return { error: "Capacity must be between 1 and 1,000, or left blank for unlimited." };
  }

  const client = await createClient();
  const { data, error } = await client
    .from("live_classes")
    .insert({
      course_id: courseId,
      instructor_id: auth.user.id,
      title,
      description: description || null,
      meeting_provider: provider,
      meeting_reference: meetingReference,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      max_participants: maxParticipants,
      status: "SCHEDULED",
    })
    .select("id")
    .single();

  if (error) {
    logInstructorLiveClassFailure("create a live class", error);
    return {
      error:
        error.code === "42501"
          ? "You can schedule live classes only for courses you manage."
          : "The live class could not be scheduled. Check the course and try again.",
    };
  }

  revalidateLiveClassPages(data.id);
  return {
    success:
      "The session is scheduled. Its meeting link was supplied by the host and has not been verified by the provider.",
  };
}

export async function cancelInstructorLiveClass(_previousState, formData) {
  const auth = await requireRole("instructor");
  const liveClassId = text(formData, "live_class_id");
  if (!UUID_PATTERN.test(liveClassId)) return { error: "The live class identifier is invalid." };

  const client = await createClient();
  const { data, error } = await client
    .from("live_classes")
    .update({ status: "CANCELLED" })
    .eq("id", liveClassId)
    .eq("instructor_id", auth.user.id)
    .eq("status", "SCHEDULED")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) logInstructorLiveClassFailure("cancel a live class", error);
    return { error: "The live class could not be cancelled." };
  }
  revalidateLiveClassPages(liveClassId);
  return { success: "The live class was cancelled and registered learners were notified." };
}

export async function completeInstructorLiveClass(_previousState, formData) {
  const auth = await requireRole("instructor");
  const liveClassId = text(formData, "live_class_id");
  if (!UUID_PATTERN.test(liveClassId)) return { error: "The live class identifier is invalid." };

  const client = await createClient();
  const { data: liveClass, error: readError } = await client
    .from("live_classes")
    .select("id,scheduled_end,status")
    .eq("id", liveClassId)
    .eq("instructor_id", auth.user.id)
    .maybeSingle();
  if (readError || !liveClass) {
    if (readError) logInstructorLiveClassFailure("load a live class", readError);
    return { error: "The live class could not be loaded." };
  }
  if (liveClass.status !== "SCHEDULED" || new Date(liveClass.scheduled_end) > new Date()) {
    return { error: "A scheduled class can be completed only after its end time." };
  }

  const { data: updatedClass, error } = await client
    .from("live_classes")
    .update({ status: "COMPLETED" })
    .eq("id", liveClassId)
    .eq("instructor_id", auth.user.id)
    .eq("status", "SCHEDULED")
    .select("id")
    .maybeSingle();
  if (error) {
    logInstructorLiveClassFailure("complete a live class", error);
    return { error: "The live class could not be marked complete." };
  }
  if (!updatedClass) return { error: "The live class could not be marked complete." };
  revalidateLiveClassPages(liveClassId);
  return { success: "The live class was marked complete." };
}

export async function recordInstructorLiveClassAttendance(_previousState, formData) {
  await requireRole("instructor");
  const liveClassId = text(formData, "live_class_id");
  const studentId = text(formData, "student_id");
  const attendanceResult = text(formData, "attendance_result");
  if (
    !UUID_PATTERN.test(liveClassId) ||
    !UUID_PATTERN.test(studentId) ||
    !["ATTENDED", "NO_SHOW"].includes(attendanceResult)
  ) {
    return { error: "The attendance decision is invalid." };
  }

  const client = await createClient();
  const { error } = await client.rpc("record_live_class_attendance", {
    target_live_class_id: liveClassId,
    target_student_id: studentId,
    attendance_result: attendanceResult,
  });
  if (error) {
    logInstructorLiveClassFailure("record live class attendance", error);
    return {
      error:
        error.code === "42501" || error.code === "23514"
          ? error.message
          : "Attendance could not be recorded.",
    };
  }
  revalidateLiveClassPages(liveClassId);
  return { success: "Attendance was recorded and added to the audit history." };
}
