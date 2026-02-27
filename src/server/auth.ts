import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { User } from "@shared/schema";
import { storage } from "./storage";

const SESSION_COOKIE = "wolo_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  const { data: session } = await supabaseAdmin
    .from("sessions")
    .select("user_id, expires_at")
    .eq("id", sessionToken)
    .single();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await supabaseAdmin.from("sessions").delete().eq("id", sessionToken);
    return null;
  }

  const user = await storage.getUser(session.user_id);
  return user || null;
}

export async function createSession(userId: string): Promise<string> {
  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  await supabaseAdmin.from("sessions").insert({
    id: sessionToken,
    user_id: userId,
    expires_at: expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return sessionToken;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    await supabaseAdmin.from("sessions").delete().eq("id", sessionToken);
  }
  cookieStore.delete(SESSION_COOKIE);
}
