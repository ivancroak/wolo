import { supabaseAdmin } from "@/lib/supabase/server";
import type { NotificationType } from "@shared/schema";

export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  linkUrl?: string
): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body,
    link_url: linkUrl ?? null,
    read: false,
  });
  if (error) {
    console.error("[notify] Failed to insert notification:", error.message);
  }
}
