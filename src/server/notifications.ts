import { supabaseAdmin } from "@/lib/supabase/server";
import type { NotificationType } from "@shared/schema";
import { sendEmail } from "@/server/email";

function escapeHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function buildEmailHtml(body: string, link: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #333;">
          <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.5px;">wolo</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;color:#e5e5e5;font-size:15px;line-height:1.6;">${escapeHtml(body)}</p>
          <a href="${link}" style="display:inline-block;padding:10px 24px;background:#fff;color:#111;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">View in App</a>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #333;">
          <p style="margin:0;color:#666;font-size:12px;">
            <a href="https://woloapp.xyz" style="color:#888;text-decoration:none;">woloapp.xyz</a> &mdash; Solana social media marketplace
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://woloapp.xyz";
    const link = linkUrl ? `${baseUrl}${linkUrl}` : baseUrl;
    await sendEmail(emailTo, title, buildEmailHtml(body, link));
  }
}
