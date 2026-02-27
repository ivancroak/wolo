import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { getClientIp, checkRateLimit } from "@/server/with-rate-limit";
import { getUserTweets, getUserInfo } from "@/server/twitter-client";
import crypto from "crypto";

function generateVerificationCode(userId: string, handle: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is required");
  const hash = crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${handle.toLowerCase()}`)
    .digest("hex")
    .slice(0, 12);
  return `wolo-verify-${hash}`;
}

// GET: returns the verification code for the user to tweet
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "verify-twitter-get", 20, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await storage.getProfile(user.id);
  if (!profile?.twitterHandle) {
    return NextResponse.json(
      { message: "Save your X handle in profile settings first" },
      { status: 400 }
    );
  }

  const code = generateVerificationCode(user.id, profile.twitterHandle);
  return NextResponse.json({
    code,
    handle: profile.twitterHandle,
    tweetText: `I am with @wolo_xyz ${code}`,
    verified: profile.twitterVerified,
  });
}

// POST: check if user has tweeted the verification code
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "verify-twitter", 5, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await storage.getProfile(user.id);
  if (!profile?.twitterHandle) {
    return NextResponse.json(
      { message: "Save your X handle in profile settings first" },
      { status: 400 }
    );
  }

  if (profile.twitterVerified) {
    return NextResponse.json({ verified: true, message: "Already verified" });
  }

  const code = generateVerificationCode(user.id, profile.twitterHandle);

  try {
    const tweets = await getUserTweets(profile.twitterHandle);
    const found = tweets.some((t) => t.text.includes(code));

    if (found) {
      await storage.setTwitterVerified(user.id, true);

      // Check blue checkmark status
      let isBlueVerified = false;
      try {
        const userInfo = await getUserInfo(profile.twitterHandle);
        isBlueVerified = !!userInfo?.isBlueVerified;
      } catch {}
      if (isBlueVerified) {
        await storage.updateProfile(user.id, { isInfluencer: true }, true);
      }

      return NextResponse.json({
        verified: true,
        isBlueVerified,
        message: isBlueVerified
          ? "X account verified with blue checkmark!"
          : "X account verified!",
      });
    }

    return NextResponse.json({
      verified: false,
      message: "Verification tweet not found. Make sure you tweeted the exact code and try again.",
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to check tweets. Please try again later." },
      { status: 502 }
    );
  }
}
