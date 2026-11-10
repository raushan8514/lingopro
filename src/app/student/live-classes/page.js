import Link from "next/link";
import { connection } from "next/server";
import { CalendarClock, Video } from "lucide-react";
import { StudentPageHeader } from "@/components/student/student-components";
import { StudentLiveClassRegistrationForm } from "@/components/student/live-class-forms";
import { getStudentLiveClassesData } from "@/lib/live-classes/data";

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

export default async function StudentLiveClassesPage() {
  await connection();
  const { classes } = await getStudentLiveClassesData();
  return (
    <div className="student-page">
      <StudentPageHeader
        eyebrow="Learn together"
        title="Live classes"
        description="Browse sessions for your enrolled courses, register for a seat, and access the host-provided meeting link."
      />
      {classes.length ? (
        <div className="student-live-class-list">
          {classes.map((liveClass) => {
            const registered =
              liveClass.registration?.registration_status === "REGISTERED";
            return (
              <article className="student-panel student-live-class-card" key={liveClass.id}>
                <header className="student-panel-heading">
                  <div>
                    <p className="student-eyebrow">{liveClass.course?.title || "Your course"}</p>
                    <h2>{liveClass.title}</h2>
                  </div>
                  <Video size={20} aria-hidden="true" />
                </header>
                {liveClass.description && <p>{liveClass.description}</p>}
                <p className="student-live-class-time">
                  <CalendarClock size={17} aria-hidden="true" />
                  {formatUtc(liveClass.scheduled_start)}–{formatUtc(liveClass.scheduled_end)} UTC
                </p>
                <p className="student-live-class-provider">
                  {liveClass.meeting_status === "CONFIRMED"
                    ? "Meeting created and confirmed by provider"
                    : "Meeting link supplied by the host; not verified by the provider"}
                  {liveClass.max_participants
                    ? ` · Capacity: ${liveClass.max_participants}`
                    : ""}
                </p>
                {registered && liveClass.meetingLink && (
                  <Link
                    className="ui-button ui-button-secondary ui-button-sm"
                    href={liveClass.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open meeting link
                  </Link>
                )}
                {registered && liveClass.meetingLinkUnavailable && (
                  <p className="student-form-message is-error" role="status">
                    The meeting link is unavailable or invalid. Contact the instructor before joining.
                  </p>
                )}
                {!registered && liveClass.course?.slug && (
                  <Link
                    className="student-inline-link"
                    href={`/courses/${liveClass.course.slug}`}
                  >
                    Course details
                  </Link>
                )}
                <StudentLiveClassRegistrationForm
                  liveClassId={liveClass.id}
                  registration={liveClass.registration}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <section className="student-panel">
          <div className="student-library-empty">
            <CalendarClock size={24} aria-hidden="true" />
            <h2>No upcoming live classes</h2>
            <p>
              Sessions for your active courses will appear here when an instructor schedules them.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
