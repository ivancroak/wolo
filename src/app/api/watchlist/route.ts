import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { checkRateLimit } from "@/server/with-rate-limit";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const items = await storage.getWatchlist(user.id);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip, "watchlist-add", 20, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { watchedUserId } = api.watchlist.add.input.parse(body);

    if (watchedUserId === user.id) {
      return NextResponse.json({ message: "Cannot watchlist yourself" }, { status: 400 });
    }

    const already = await storage.isWatching(user.id, watchedUserId);
    if (already) {
      return NextResponse.json({ message: "Already watching this user" }, { status: 400 });
    }

    const entry = await storage.addToWatchlist(user.id, watchedUserId);
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
