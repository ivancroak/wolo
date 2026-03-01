import { NextResponse } from "next/server";
import { createNonce } from "@/server/nonce-store";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitResponse = checkRateLimit(ip, "auth-nonce", 10, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  const { walletAddress } = await request.json();
  if (!walletAddress || typeof walletAddress !== "string") {
    return NextResponse.json({ message: "walletAddress required" }, { status: 400 });
  }

  const nonce = createNonce(walletAddress);
  return NextResponse.json({ nonce });
}
