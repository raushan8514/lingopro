import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import {
  MarkAllNotificationsReadButton,
  MarkNotificationReadButton,
} from "@/components/student/student-forms";
import { StudentPageHeader } from "@/components/student/student-components";
import { getStudentNotificationsPageData } from "@/lib/student/data";
import { formatDate } from "@/lib/student/time";

export const metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

function notificationUrl(page, unreadOnly) {
  const params = new URLSearchParams();
  if (unreadOnly) params.set("unread", "true");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/student/notifications?${query}` : "/student/notifications";
}

export default async function StudentNotificationsPage({ searchParams }) {
  const params = await searchParams;
  const data = await getStudentNotificationsPageData({
    page: params.page,
    unreadOnly: params.unread === "true",
  });

  return (
    <div className="student-page">
      <StudentPageHeader
        eyebrow="Account updates"
        title="Notifications"
        description="Messages delivered to your account, with read state scoped to your student profile."
        action={data.unreadCount > 0 ? <MarkAllNotificationsReadButton /> : null}
      />
      <section className="student-panel">
        <nav className="student-library-tabs" aria-label="Notification filters">
          <Link
            href={notificationUrl(1, false)}
            aria-current={!data.unreadOnly ? "page" : undefined}
            className={!data.unreadOnly ? "is-active" : ""}
          >
            All notifications
          </Link>
          <Link
            href={notificationUrl(1, true)}
            aria-current={data.unreadOnly ? "page" : undefined}
            className={data.unreadOnly ? "is-active" : ""}
          >
            Unread
          </Link>
        </nav>

        {data.notifications.length ? (
          <ol className="student-notification-list">
            {data.notifications.map((notification) => {
              const targetUrl =
                notification.target_url?.startsWith("/") &&
                !notification.target_url.startsWith("//")
                  ? notification.target_url
                  : null;
              return (
                <li
                  className={notification.is_read ? "" : "is-unread"}
                  key={notification.id}
                >
                  <span className="student-notification-icon">
                    <Bell size={17} aria-hidden="true" />
                  </span>
                  <div className="student-notification-content">
                    <div className="student-notification-title-row">
                      <h2>{notification.title}</h2>
                      {!notification.is_read && <span className="student-unread-dot" aria-label="Unread" />}
                    </div>
                    <p>{notification.message}</p>
                    <time dateTime={notification.created_at}>
                      {formatDate(notification.created_at, { timeZone: data.goals.timezone })}
                    </time>
                    {targetUrl && (
                      <Link className="student-notification-target" href={targetUrl}>
                        Open related page <ExternalLink size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                  {!notification.is_read && (
                    <MarkNotificationReadButton notificationId={notification.id} />
                  )}
                  {notification.is_read && (
                    <span className="student-read-label">
                      <Check size={14} aria-hidden="true" /> Read
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="student-library-empty">
            <Bell size={24} aria-hidden="true" />
            <h2>{data.unreadOnly ? "You are all caught up" : "No notifications yet"}</h2>
            <p>
              {data.unreadOnly
                ? "There are no unread notifications for your account."
                : "Notifications will appear here when the platform has an account update to share."}
            </p>
          </div>
        )}

        {data.totalPages > 1 && (
          <nav className="student-pagination" aria-label="Notification pages">
            <Link
              href={notificationUrl(Math.max(1, data.page - 1), data.unreadOnly)}
              aria-disabled={data.page <= 1}
              tabIndex={data.page <= 1 ? -1 : undefined}
            >
              Previous
            </Link>
            <span>Page {data.page} of {data.totalPages}</span>
            <Link
              href={notificationUrl(Math.min(data.totalPages, data.page + 1), data.unreadOnly)}
              aria-disabled={data.page >= data.totalPages}
              tabIndex={data.page >= data.totalPages ? -1 : undefined}
            >
              Next
            </Link>
          </nav>
        )}
      </section>
    </div>
  );
}
