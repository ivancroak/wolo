import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const escrowId = parseInt(id, 10);
  if (isNaN(escrowId)) {
    return NextResponse.json({ message: "Invalid escrow ID" }, { status: 400 });
  }

  try {
    const escrow = await storage.getEscrow(escrowId);
    if (!escrow) {
      return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
    }

    if (user.id !== escrow.depositorId && user.id !== escrow.receiverId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const periods = await storage.getPayrollPeriods(escrowId);
    return NextResponse.json(periods);
  } catch (err: any) {
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
