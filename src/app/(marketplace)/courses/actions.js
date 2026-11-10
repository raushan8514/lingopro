"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function logEnrollmentFailure(error) {
  console.error("Course enrollment failed.", {
    code: error?.code,
    status: error?.status,
  });
}

export async function enrollInFreeCourseAction(_previousState, formData) {
  const courseSlug = String(formData.get("courseSlug") || "");
  const returnPath = `/courses/${encodeURIComponent(courseSlug)}`;

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseSlug) || courseSlug.length > 180) {
    return { error: "This course could not be found. Refresh the page and try again." };
  }

  let supabase;
  let user;

  try {
    supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error && error.status !== 401) {
      logEnrollmentFailure(error);
      return { error: "We couldn't verify your account. Please try again shortly." };
    }
    user = data.user;
  } catch (error) {
    logEnrollmentFailure(error);
    return { error: "We couldn't reach the account service. Please try again shortly." };
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      logEnrollmentFailure(profileError || new Error("Missing account profile."));
      return { error: "We couldn't verify your learner profile. Please try again later." };
    }
    if (profile.role !== "student") {
      return { error: "Free course enrollment is available to student accounts." };
    }

    const { data: course, error: courseError } = await supabase.rpc(
      "get_public_course_details",
      { target_slug: courseSlug },
    );

    if (courseError) {
      logEnrollmentFailure(courseError);
      return { error: "We couldn't verify this course. Please try again shortly." };
    }
    if (!course) {
      return { error: "This course is no longer available." };
    }
    if (course.price_cents !== 0) {
      return { error: "Online payment is not available yet. No enrollment was created." };
    }

    const { data: existingEnrollment, error: lookupError } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .in("status", ["ACTIVE", "COMPLETED"])
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      logEnrollmentFailure(lookupError);
      return { error: "We couldn't verify your enrollment status. Please try again." };
    }
    if (existingEnrollment) {
      return {
        success: true,
        message: existingEnrollment.status === "COMPLETED"
          ? "You have already completed this course."
          : "You are already enrolled in this course.",
      };
    }

    const { error: insertError } = await supabase
      .from("enrollments")
      .insert({
        student_id: user.id,
        course_id: course.id,
        status: "ACTIVE",
        enrollment_type: "FREE",
      });

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: racedEnrollment, error: raceLookupError } = await supabase
          .from("enrollments")
          .select("id")
          .eq("student_id", user.id)
          .eq("course_id", course.id)
          .eq("status", "ACTIVE")
          .maybeSingle();

        if (!raceLookupError && racedEnrollment) {
          return {
            success: true,
            message: "You are already enrolled in this course.",
          };
        }

        if (raceLookupError) logEnrollmentFailure(raceLookupError);
      }

      logEnrollmentFailure(insertError);
      return {
        error: "Enrollment could not be completed. Refresh the page and try again.",
      };
    }

    return {
      success: true,
      message: "You’re enrolled. Your course is ready when you are.",
    };
  } catch (error) {
    logEnrollmentFailure(error);
    return { error: "Enrollment could not be completed. Please try again shortly." };
  }
}
