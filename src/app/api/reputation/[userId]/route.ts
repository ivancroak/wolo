import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const reputation = await storage.getReputation(params.userId);
  return NextResponse.json(reputation);
}
