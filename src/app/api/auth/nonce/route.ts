import { NextResponse } from "next/server";
import { createNonce } from "@/server/nonce-store";

export async function POST(request: Request) {
  const { walletAddress } = await request.json();
  if (!walletAddress || typeof walletAddress !== "string") {
    return NextResponse.json({ message: "walletAddress required" }, { status: 400 });
  }

  const nonce = createNonce(walletAddress);
  return NextResponse.json({ nonce });
}
