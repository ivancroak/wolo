import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { storage } from "@/server/storage";
import { api } from "@shared/routes";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await storage.getNotifications(user.id);
    return NextResponse.json(notifications);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const input = api.notifications.markRead.input.parse(body);

  try {
    await storage.markNotificationsRead(user.id, input.ids);
    return NextResponse.json({ message: "Marked as read" });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
