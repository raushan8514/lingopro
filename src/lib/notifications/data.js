import "server-only";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

function logNotificationReadFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

export async function getRoleNotifications(role, { page = 1, unreadOnly = false } = {}) {
  const identity = await requireRole(role);
  const client = await createClient({ allowCookieWrites: false });
  const pageNumber = Math.max(1, Math.min(10000, Number(page) || 1));
  const [unread, notifications] = await Promise.all([
    client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", identity.user.id)
      .eq("is_read", false),
    (async () => {
      let query = client
        .from("notifications")
        .select("id,title,message,notification_type,target_url,is_read,read_at,created_at", {
          count: "exact",
        })
        .eq("user_id", identity.user.id)
        .order("created_at", { ascending: false });
      if (unreadOnly) query = query.eq("is_read", false);
      return query.range(
        (pageNumber - 1) * PAGE_SIZE,
        pageNumber * PAGE_SIZE - 1,
      );
    })(),
  ]);

  if (unread.error) {
    logNotificationReadFailure("count unread notifications", unread.error);
    throw new Error("The notification count could not be loaded.");
  }
  if (notifications.error) {
    logNotificationReadFailure("load notifications", notifications.error);
    throw new Error("Notifications could not be loaded.");
  }

  return {
    notifications: notifications.data || [],
    unreadCount: unread.count || 0,
    total: notifications.count || 0,
    page: pageNumber,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil((notifications.count || 0) / PAGE_SIZE)),
    unreadOnly,
  };
}

export async function getPortalUnreadNotificationCount(role) {
  const identity = await requireRole(role);
  const client = await createClient({ allowCookieWrites: false });
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", identity.user.id)
    .eq("is_read", false);
  if (error) {
    logNotificationReadFailure("count portal notifications", error);
    throw new Error("The notification count could not be loaded.");
  }
  return count || 0;
}
