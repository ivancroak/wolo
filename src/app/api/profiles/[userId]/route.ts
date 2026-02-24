import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const user = await storage.getUser(userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = await storage.getProfile(userId);
  return NextResponse.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    profile: profile ? {
      bio: profile.bio,
      twitterHandle: profile.twitterHandle,
      isInfluencer: profile.isInfluencer,
    } : null,
  });
}
