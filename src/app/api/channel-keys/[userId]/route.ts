import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const publicKey = await storage.getChannelPublicKey(params.userId);
  if (!publicKey) {
    return NextResponse.json({ message: "Channel key not found" }, { status: 404 });
  }

  return NextResponse.json({ publicKey });
}
