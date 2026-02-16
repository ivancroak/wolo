import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { storage } from "@/server/storage";
import { z } from "zod";

const ADMIN_WALLET = "2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL";

const resolveSchema = z.object({
  depositorShareBps: z.number().int().min(0).max(10000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (user.id !== ADMIN_WALLET) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const escrowId = parseInt(id, 10);
  if (isNaN(escrowId)) {
    return NextResponse.json({ message: "Invalid escrow ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { depositorShareBps } = resolveSchema.parse(body);

    const escrow = await storage.getEscrow(escrowId);
    if (!escrow) {
      return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
    }

    if (escrow.phase !== "disputed") {
      return NextResponse.json(
        { message: "Escrow is not in disputed phase" },
        { status: 400 },
      );
    }

    const updated = await storage.updateEscrowPhase(escrowId, "released");

    return NextResponse.json({ ...updated, depositorShareBps });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: err.errors[0].message, field: err.errors[0].path.join(".") },
        { status: 400 },
      );
    }
    throw err;
  }
}
