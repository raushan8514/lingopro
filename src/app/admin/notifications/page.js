import { AdminPageHeader } from "@/components/admin/admin-components";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { getRoleNotifications } from "@/lib/notifications/data";

export const metadata = {
  title: "Administrator notifications",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsPage({ searchParams }) {
  const params = await searchParams;
  const data = await getRoleNotifications("admin", {
    page: params.page,
    unreadOnly: params.unread === "true",
  });
  return (
    <div className="student-page admin-page">
      <AdminPageHeader
        eyebrow="Account updates"
        title="Notifications"
        description="Private messages delivered to your administrator account. User notifications are not visible here."
      />
      <NotificationCenter data={data} role="admin" />
    </div>
  );
}
