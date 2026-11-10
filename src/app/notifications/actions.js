"use server";

import { revalidatePath } from "next/cache";
import { getRoleHomePath } from "@/lib/auth/paths";
import { getAuthContext } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAuthenticatedNotificationUser() {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user) {
    throw new Error("Sign in to manage your notifications.");
  }
  return auth;
}

export async function markPortalNotificationRead(formData) {
  const auth = await getAuthenticatedNotificationUser();
  const notificationId = String(formData.get("notification_id") || "");
  if (!UUID_PATTERN.test(notificationId)) {
    throw new Error("The notification identifier is invalid.");
  }

  const client = await createClient();
  const { error } = await client.rpc("mark_notification_read", {
    target_notification_id: notificationId,
  });
  if (error) {
    console.error("Unable to mark a portal notification as read.", {
      code: error.code,
      status: error.status,
      name: error.name,
    });
    throw new Error("The notification could not be marked as read.");
  }

  revalidatePath(`${getRoleHomePath(auth.role)}/notifications`);
  revalidatePath(getRoleHomePath(auth.role));
}

export async function markAllPortalNotificationsRead() {
  const auth = await getAuthenticatedNotificationUser();
  const client = await createClient();
  const { error } = await client
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Unable to mark all portal notifications as read.", {
      code: error.code,
      status: error.status,
      name: error.name,
    });
    throw new Error("Notifications could not be marked as read.");
  }

  revalidatePath(`${getRoleHomePath(auth.role)}/notifications`);
  revalidatePath(getRoleHomePath(auth.role));
}
