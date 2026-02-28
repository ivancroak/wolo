import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { getClientIp, checkRateLimit } from "@/server/with-rate-limit";
import { sendEmail } from "@/server/email";
import crypto from "crypto";

const emailCodes = new Map<string, { code: string; email: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  emailCodes.forEach((entry, key) => {
    if (now > entry.expiresAt) emailCodes.delete(key);
  });
}, 60_000);

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// POST: send verification code to user's email
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "verify-email-send", 5, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await storage.getProfile(user.id);
  if (!profile?.email) {
    return NextResponse.json(
      { message: "Save your email in profile settings first" },
      { status: 400 },
    );
  }

  if (profile.emailVerified) {
    return NextResponse.json({ verified: true, message: "Already verified" });
  }

  const code = generateCode();
  emailCodes.set(user.id, {
    code,
    email: profile.email,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  await sendEmail(
    profile.email,
    "Verify your email - Wolo",
    `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
      <h2 style="margin:0 0 16px">Email Verification</h2>
      <p>Your verification code is:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f4f4f5;border-radius:8px;margin:16px 0">${code}</div>
      <p style="color:#71717a;font-size:14px">This code expires in 10 minutes.</p>
    </div>`,
  );

  return NextResponse.json({ sent: true, message: "Verification code sent to your email" });
}

// PATCH: verify the code
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "verify-email-check", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await storage.getProfile(user.id);
  if (!profile?.email) {
    return NextResponse.json({ message: "No email set" }, { status: 400 });
  }

  if (profile.emailVerified) {
    return NextResponse.json({ verified: true });
  }

  const body = await request.json();
  const inputCode = String(body.code ?? "").trim();

  if (!inputCode || inputCode.length !== 6) {
    return NextResponse.json({ message: "Invalid code" }, { status: 400 });
  }

  const entry = emailCodes.get(user.id);
  if (!entry) {
    return NextResponse.json(
      { message: "No verification code found. Please request a new one." },
      { status: 400 },
    );
  }

  if (Date.now() > entry.expiresAt) {
    emailCodes.delete(user.id);
    return NextResponse.json(
      { message: "Code expired. Please request a new one." },
      { status: 400 },
    );
  }

  if (entry.email !== profile.email) {
    emailCodes.delete(user.id);
    return NextResponse.json(
      { message: "Email changed since code was sent. Please request a new one." },
      { status: 400 },
    );
  }

  if (entry.code !== inputCode) {
    return NextResponse.json(
      { verified: false, message: "Incorrect code. Please try again." },
      { status: 400 },
    );
  }

  emailCodes.delete(user.id);

  const { error } = await (await import("@/lib/supabase/server")).supabaseAdmin
    .from("profiles")
    .update({ email_verified: true })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ message: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({ verified: true, message: "Email verified!" });
}
