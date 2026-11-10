import { CalendarClock, Video } from "lucide-react";
import {
  AdminPageHeader,
  AdminPanel,
  AdminStatus,
} from "@/components/admin/admin-components";
import { getAdminLiveClassesData } from "@/lib/live-classes/data";

export const metadata = {
  title: "Live class oversight",
  robots: { index: false, follow: false },
};

function formatUtc(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function AdminLiveClassesPage() {
  const { classes } = await getAdminLiveClassesData();
  return (
    <div className="student-page admin-page">
      <AdminPageHeader
        eyebrow="Operational oversight"
        title="Live classes"
        description="Review scheduled sessions, registration counts, and instructor-recorded attendance. Meeting links are intentionally not exposed in this view."
      />
      <AdminPanel eyebrow="Platform sessions" title={`${classes.length} recent sessions`}>
        {classes.length ? (
          <div className="admin-record-list">
            {classes.map((liveClass) => (
              <article className="admin-record-row admin-live-class-record" key={liveClass.id}>
                <div>
                  <div className="admin-live-class-heading">
                    <Video size={17} aria-hidden="true" />
                    <strong>{liveClass.title}</strong>
                    <AdminStatus value={liveClass.status} />
                  </div>
                  <p>
                    {liveClass.course?.title || "Course"} ·{" "}
                    {liveClass.instructor?.full_name || "Instructor"}
                  </p>
                  <p>
                    <CalendarClock size={14} aria-hidden="true" />{" "}
                    {formatUtc(liveClass.scheduled_start)}–{formatUtc(liveClass.scheduled_end)} UTC
                  </p>
                  <p>
                    {liveClass.registrations.length} registration
                    {liveClass.registrations.length === 1 ? "" : "s"}
                    {liveClass.max_participants
                      ? ` · Capacity ${liveClass.max_participants}`
                      : ""}
                  </p>
                  <details className="admin-live-class-attendance">
                    <summary>Review registration and attendance records</summary>
                    {liveClass.registrations.length ? (
                      <ul>
                        {liveClass.registrations.map((registration) => (
                          <li key={registration.id}>
                            <span>{registration.student?.full_name || "Learner"}</span>
                            <AdminStatus value={registration.registration_status} />
                            {registration.attendance_source && (
                              <span>
                                {registration.attendance_source.toLowerCase()} recorded
                                {registration.attendance_marked_at
                                  ? ` · ${formatUtc(registration.attendance_marked_at)}`
                                  : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No learner registrations.</p>
                    )}
                  </details>
                </div>
                <AdminStatus value={liveClass.meeting_status} />
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-form-note">No live classes have been scheduled.</p>
        )}
      </AdminPanel>
    </div>
  );
}
