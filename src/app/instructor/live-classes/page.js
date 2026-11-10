import { connection } from "next/server";
import { CalendarClock, UsersRound, Video } from "lucide-react";
import {
  InstructorEmptyState,
  InstructorPageHeader,
  InstructorPanel,
  InstructorStatus,
} from "@/components/instructor/instructor-components";
import {
  InstructorAttendanceForm,
  InstructorLiveClassCreateForm,
  InstructorLiveClassLifecycleForm,
} from "@/components/instructor/live-class-forms";
import { getInstructorLiveClassesData } from "@/lib/live-classes/data";

export const metadata = {
  title: "Live classes",
  robots: { index: false, follow: false },
};

function formatUtc(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function InstructorLiveClassesPage() {
  await connection();
  const { classes, courses, now } = await getInstructorLiveClassesData();

  return (
    <div className="student-page instructor-page">
      <InstructorPageHeader
        eyebrow="Synchronous learning"
        title="Live classes"
        description="Schedule sessions for published courses, manage registrations, and record attendance after class."
      />

      <InstructorPanel eyebrow="Host a session" title="Schedule a live class">
        <p className="instructor-live-class-provider-note">
          Zoom and Google Meet links are supplied by the host. LingoPro does not
          create or verify provider meetings until an integration is configured.
          Times are entered and shown in UTC.
        </p>
        <InstructorLiveClassCreateForm courses={courses} />
      </InstructorPanel>

      <InstructorPanel eyebrow="Teaching calendar" title="Your sessions">
        {classes.length ? (
          <div className="instructor-live-class-list">
            {classes.map((liveClass) => {
              const ended = new Date(liveClass.scheduled_end).getTime() <= now;
              return (
                <article className="instructor-live-class-card" key={liveClass.id}>
                  <header>
                    <div>
                      <p className="instructor-eyebrow">{liveClass.course?.title || "Course"}</p>
                      <h3>{liveClass.title}</h3>
                    </div>
                    <InstructorStatus status={liveClass.status} />
                  </header>
                  {liveClass.description && <p>{liveClass.description}</p>}
                  <p className="instructor-live-class-time">
                    <CalendarClock size={16} aria-hidden="true" />
                    {formatUtc(liveClass.scheduled_start)}–{formatUtc(liveClass.scheduled_end)} UTC
                  </p>
                  <p className="instructor-live-class-meta">
                    <UsersRound size={16} aria-hidden="true" />
                    {liveClass.roster.length} registration{liveClass.roster.length === 1 ? "" : "s"}
                    {liveClass.max_participants
                      ? ` · Capacity ${liveClass.max_participants}`
                      : " · Unlimited capacity"}
                  </p>
                  <p className="instructor-live-class-provider-note">
                    {liveClass.meeting_status === "CONFIRMED"
                      ? "Provider confirmed"
                      : "Host-provided meeting link · not provider-verified"}
                  </p>
                  {liveClass.meetingLink && liveClass.status === "SCHEDULED" && (
                    <a
                      className="instructor-button-link is-subtle"
                      href={liveClass.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Video size={15} aria-hidden="true" /> Open host link
                    </a>
                  )}
                  {liveClass.status === "SCHEDULED" && !liveClass.meetingLink && (
                    <p className="instructor-form-message is-error" role="status">
                      The stored meeting URL is invalid or unavailable. Update it before the session.
                    </p>
                  )}
                  <InstructorLiveClassLifecycleForm
                    liveClass={liveClass}
                    canComplete={ended}
                  />
                  {liveClass.roster.length > 0 && (
                    <details className="instructor-live-class-roster">
                      <summary>
                        <UsersRound size={15} aria-hidden="true" /> Registrations and attendance
                      </summary>
                      <ul>
                        {liveClass.roster.map((registration) => (
                          <li key={registration.student_id}>
                            <div>
                              <strong>{registration.student_name}</strong>
                              <span>{registration.registration_status.replaceAll("_", " ")}</span>
                              {registration.attendance_source && (
                                <span>
                                  {registration.attendance_source.toLowerCase()}-recorded
                                  {registration.attendance_marked_at
                                    ? ` · ${formatUtc(registration.attendance_marked_at)}`
                                    : ""}
                                </span>
                              )}
                            </div>
                            {registration.registration_status === "REGISTERED" && ended && (
                              <InstructorAttendanceForm
                                liveClassId={liveClass.id}
                                studentId={registration.student_id}
                                studentName={registration.student_name}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                      {!ended && (
                        <p className="instructor-form-note">
                          Attendance entry becomes available after the scheduled end time.
                        </p>
                      )}
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <InstructorEmptyState
            title="No live classes scheduled"
            description="Schedule a session for a published course to make it available to enrolled students."
          />
        )}
      </InstructorPanel>
    </div>
  );
}
