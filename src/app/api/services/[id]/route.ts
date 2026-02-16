import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const service = await storage.getService(Number(id));
  if (!service) {
    return NextResponse.json({ message: "Service not found" }, { status: 404 });
  }
  return NextResponse.json(service);
}
