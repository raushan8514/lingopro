"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LiveNotificationSync({ userId }) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return undefined;
    const client = createClient();
    let fallbackTimer;
    const refresh = () => router.refresh();
    const startFallback = () => {
      if (!fallbackTimer) {
        fallbackTimer = window.setInterval(refresh, 60_000);
      }
    };
    const stopFallback = () => {
      if (fallbackTimer) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = undefined;
      }
    };
    const channel = client
      .channel(`private-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        refresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopFallback();
        } else {
          startFallback();
        }
      });

    return () => {
      stopFallback();
      void client.removeChannel(channel);
    };
  }, [router, userId]);

  return null;
}
