import {
  InstructorPageHeader,
} from "@/components/instructor/instructor-components";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { getRoleNotifications } from "@/lib/notifications/data";

export const metadata = {
  title: "Instructor notifications",
  robots: { index: false, follow: false },
};

export default async function InstructorNotificationsPage({ searchParams }) {
  const params = await searchParams;
  const data = await getRoleNotifications("instructor", {
    page: params.page,
    unreadOnly: params.unread === "true",
  });
  return (
    <div className="student-page instructor-page">
      <InstructorPageHeader
        eyebrow="Account updates"
        title="Notifications"
        description="Private messages delivered to your instructor account."
      />
      <NotificationCenter data={data} role="instructor" />
    </div>
  );
}
