import { NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function checkRateLimit(ip: string, endpoint: string, maxRequests = 30, windowMs = 60000) {
  const key = `${ip}:${endpoint}`;
  const result = rateLimit(key, maxRequests, windowMs);
  if (!result.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }
  return null;
}

export function checkSessionRateLimit(userId: string, endpoint: string, maxRequests = 30, windowMs = 60000) {
  const key = `session:${userId}:${endpoint}`;
  const result = rateLimit(key, maxRequests, windowMs);
  if (!result.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }
  return null;
}
