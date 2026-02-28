import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: "Wolo <noreply@woloapp.xyz>",
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("[sendEmail]", err);
  }
}
