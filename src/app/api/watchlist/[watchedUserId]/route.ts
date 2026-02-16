import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ watchedUserId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { watchedUserId } = await params;
  await storage.removeFromWatchlist(user.id, watchedUserId);
  return NextResponse.json({ message: "Removed from watchlist" });
}
