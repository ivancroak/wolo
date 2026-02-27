import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { getClientIp, checkRateLimit } from "@/server/with-rate-limit";
import { getUserInfo } from "@/server/twitter-client";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "check-blue", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await storage.getProfile(user.id);
  if (!profile?.twitterHandle) {
    return NextResponse.json(
      { message: "Save your X handle first" },
      { status: 400 }
    );
  }

  try {
    const userInfo = await getUserInfo(profile.twitterHandle);
    const isBlueVerified = !!userInfo?.isBlueVerified;

    await storage.updateProfile(user.id, { isInfluencer: isBlueVerified }, true);

    return NextResponse.json({ isBlueVerified });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
