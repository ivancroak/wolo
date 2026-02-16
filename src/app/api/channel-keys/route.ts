import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { publicKey } = await request.json();
  if (!publicKey || typeof publicKey !== "string") {
    return NextResponse.json({ message: "publicKey required" }, { status: 400 });
  }

  await storage.setChannelPublicKey(user.id, publicKey);
  return NextResponse.json({ ok: true });
}
