import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import {
  markAllPortalNotificationsRead,
  markPortalNotificationRead,
} from "@/app/notifications/actions";
import { formatDate } from "@/lib/student/time";

function notificationUrl(role, page, unreadOnly) {
  const params = new URLSearchParams();
  if (unreadOnly) params.set("unread", "true");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/${role}/notifications${query ? `?${query}` : ""}`;
}

export function NotificationCenter({ data, role }) {
  return (
    <section className="student-panel">
      <header className="student-panel-heading">
        <div>
          <p className="student-eyebrow">Private account updates</p>
          <h2>Your notifications</h2>
        </div>
        {data.unreadCount > 0 && (
          <form action={markAllPortalNotificationsRead}>
            <button className="ui-button ui-button-ghost ui-button-sm" type="submit">
              Mark all read
            </button>
          </form>
        )}
      </header>

      <nav className="student-library-tabs" aria-label="Notification filters">
        <Link
          href={notificationUrl(role, 1, false)}
          aria-current={!data.unreadOnly ? "page" : undefined}
          className={!data.unreadOnly ? "is-active" : ""}
        >
          All notifications
        </Link>
        <Link
          href={notificationUrl(role, 1, true)}
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
                    {!notification.is_read && (
                      <span className="student-unread-dot" aria-label="Unread" />
                    )}
                  </div>
                  <p>{notification.message}</p>
                  <time dateTime={notification.created_at}>
                    {formatDate(notification.created_at)}
                  </time>
                  {targetUrl && (
                    <Link className="student-notification-target" href={targetUrl}>
                      Open related page <ExternalLink size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
                {!notification.is_read ? (
                  <form action={markPortalNotificationRead}>
                    <input
                      type="hidden"
                      name="notification_id"
                      value={notification.id}
                    />
                    <button
                      className="ui-button ui-button-ghost ui-button-sm"
                      type="submit"
                    >
                      Mark read
                    </button>
                  </form>
                ) : (
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
              : "Account updates will appear here when the platform has something to share."}
          </p>
        </div>
      )}

      {data.totalPages > 1 && (
        <nav className="student-pagination" aria-label="Notification pages">
          <Link
            href={notificationUrl(role, Math.max(1, data.page - 1), data.unreadOnly)}
            aria-disabled={data.page <= 1}
            tabIndex={data.page <= 1 ? -1 : undefined}
          >
            Previous
          </Link>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <Link
            href={notificationUrl(
              role,
              Math.min(data.totalPages, data.page + 1),
              data.unreadOnly,
            )}
            aria-disabled={data.page >= data.totalPages}
            tabIndex={data.page >= data.totalPages ? -1 : undefined}
          >
            Next
          </Link>
        </nav>
      )}
    </section>
  );
}
