import { supabaseAdmin } from "@/lib/supabase/server";
import type { NotificationType } from "@shared/schema";
import { sendEmail } from "@/server/email";

function escapeHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  linkUrl?: string,
  emailTo?: string,
  emailEnabled?: boolean,
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

  if (emailTo && emailEnabled) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
    const link = linkUrl ? `${baseUrl}${linkUrl}` : baseUrl;
    await sendEmail(
      emailTo,
      title,
      `<p>${escapeHtml(body)}</p><p><a href="${link}">View in app</a></p>`,
    );
  }
}
