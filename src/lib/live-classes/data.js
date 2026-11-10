import "server-only";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

function logLiveClassFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

async function read(operation, query) {
  const { data, error } = await query;
  if (error) {
    logLiveClassFailure(operation, error);
    throw new Error(`Live class data could not load ${operation}.`);
  }
  return data || [];
}

function normalizeCourse(course) {
  return Array.isArray(course) ? course[0] : course;
}

function validateMeetingUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return value;
  } catch {
    return null;
  }
  return null;
}

export async function getStudentLiveClassesData() {
  const identity = await requireRole("student");
  const client = await createClient({ allowCookieWrites: false });
  const [classes, registrations] = await Promise.all([
    read(
      "upcoming sessions",
      client
        .from("live_classes")
        .select(
          "id,course_id,title,description,meeting_provider,scheduled_start,scheduled_end,status,max_participants,meeting_status,course:courses!inner(title,slug)",
        )
        .eq("status", "SCHEDULED")
        .gte("scheduled_end", new Date().toISOString())
        .order("scheduled_start", { ascending: true })
        .limit(100),
    ),
    read(
      "your registrations",
      client
        .from("live_class_registrations")
        .select("id,live_class_id,registration_status,registered_at")
        .eq("student_id", identity.user.id),
    ),
  ]);
  const registrationByClass = new Map(
    registrations.map((registration) => [registration.live_class_id, registration]),
  );
  const visibleClasses = classes.map((liveClass) => ({
    ...liveClass,
    course: normalizeCourse(liveClass.course),
    registration: registrationByClass.get(liveClass.id) || null,
  }));
  const registeredIds = new Set(
    visibleClasses
      .filter(
        (liveClass) =>
          liveClass.registration?.registration_status === "REGISTERED",
      )
      .map((liveClass) => liveClass.id),
  );
  const meetingEntries = await Promise.all(
    [...registeredIds].map(async (liveClassId) => {
      const { data, error } = await client.rpc("get_live_class_meeting_reference", {
        target_live_class_id: liveClassId,
      });
      if (error) {
        logLiveClassFailure("load an authorized meeting link", error);
        throw new Error("A registered meeting link could not be loaded.");
      }
      return [liveClassId, data];
    }),
  );
  const meetingByClass = new Map(meetingEntries);

  return {
    classes: visibleClasses.map((liveClass) => {
      const meetingReference = meetingByClass.get(liveClass.id);
      const meetingLink = meetingReference
        ? validateMeetingUrl(meetingReference)
        : null;
      if (meetingReference && !meetingLink) {
        console.error("A live class has an invalid host-provided meeting URL.", {
          liveClassId: liveClass.id,
        });
      }
      return {
        ...liveClass,
        meetingLink,
        meetingLinkUnavailable: registeredIds.has(liveClass.id) && !meetingLink,
      };
    }),
  };
}

export async function getInstructorLiveClassesData() {
  const identity = await requireRole("instructor");
  const client = await createClient({ allowCookieWrites: false });
  const [classes, courses] = await Promise.all([
    read(
      "your sessions",
      client
        .from("live_classes")
        .select(
          "id,course_id,title,description,meeting_provider,scheduled_start,scheduled_end,status,max_participants,meeting_status,created_at,course:courses!inner(title)",
        )
        .eq("instructor_id", identity.user.id)
        .order("scheduled_start", { ascending: false })
        .limit(100),
    ),
    read(
      "your published courses",
      client
        .from("courses")
        .select("id,title")
        .eq("instructor_id", identity.user.id)
        .eq("status", "PUBLISHED")
        .order("title", { ascending: true }),
    ),
  ]);
  const sessions = await Promise.all(
    classes.map(async (liveClass) => {
      const [rosterResult, meetingResult] = await Promise.all([
        client.rpc("get_live_class_roster", {
          target_live_class_id: liveClass.id,
        }),
        liveClass.status === "SCHEDULED"
          ? client.rpc("get_live_class_meeting_reference", {
              target_live_class_id: liveClass.id,
            })
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (rosterResult.error) {
        logLiveClassFailure("load a session roster", rosterResult.error);
        throw new Error("Live class attendance could not be loaded.");
      }
      if (meetingResult.error) {
        logLiveClassFailure("load a managed meeting link", meetingResult.error);
        throw new Error("The managed meeting link could not be loaded.");
      }
      const meetingLink = meetingResult.data
        ? validateMeetingUrl(meetingResult.data)
        : null;
      if (meetingResult.data && !meetingLink) {
        console.error("A live class has an invalid host-provided meeting URL.", {
          liveClassId: liveClass.id,
        });
      }
      return {
        ...liveClass,
        course: normalizeCourse(liveClass.course),
        roster: rosterResult.data || [],
        meetingLink,
      };
    }),
  );
  return { classes: sessions, courses, now: new Date().getTime() };
}

export async function getAdminLiveClassesData() {
  await requireRole("admin");
  const client = await createClient({ allowCookieWrites: false });
  const classes = await read(
    "platform sessions",
    client
      .from("live_classes")
      .select(
        "id,course_id,instructor_id,title,meeting_provider,scheduled_start,scheduled_end,status,max_participants,meeting_status,course:courses!inner(title),instructor:profiles!live_classes_instructor_id_fkey(full_name)",
      )
      .order("scheduled_start", { ascending: false })
      .limit(100),
  );
  const classIds = classes.map((liveClass) => liveClass.id);
  const registrations = classIds.length
    ? await read(
        "session registrations",
        client
          .from("live_class_registrations")
          .select(
            "id,live_class_id,student_id,registration_status,registered_at,attendance_marked_by,attendance_marked_at,attendance_source,student:profiles!live_class_registrations_student_id_fkey(full_name)",
          )
          .in("live_class_id", classIds)
          .order("registered_at", { ascending: true }),
      )
    : [];
  const registrationByClass = new Map();
  for (const registration of registrations) {
    const list = registrationByClass.get(registration.live_class_id) || [];
    list.push({
      ...registration,
      student: normalizeCourse(registration.student),
    });
    registrationByClass.set(registration.live_class_id, list);
  }
  return {
    classes: classes.map((liveClass) => ({
      ...liveClass,
      course: normalizeCourse(liveClass.course),
      instructor: normalizeCourse(liveClass.instructor),
      registrations: registrationByClass.get(liveClass.id) || [],
    })),
  };
}
