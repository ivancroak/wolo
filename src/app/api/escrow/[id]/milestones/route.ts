import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { checkRateLimit } from "@/server/with-rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip, "add-milestone", 20, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const escrow = await storage.getEscrow(Number(id));
  if (!escrow) {
    return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
  }

  if (escrow.depositorId !== user.id) {
    return NextResponse.json({ message: "Only the depositor can add milestones" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = api.escrow.addMilestone.input.parse(body);

    // Validate that total milestone amounts don't exceed escrow amount
    const existingMilestones = await storage.getMilestones(escrow.id);
    const existingTotal = existingMilestones.reduce((sum, m) => sum + Number(m.amount), 0);
    const newAmount = Number(input.amount);
    if (existingTotal + newAmount > Number(escrow.amount)) {
      return NextResponse.json({
        message: `Total milestone amounts (${existingTotal + newAmount}) would exceed escrow amount (${escrow.amount})`,
      }, { status: 400 });
    }

    const milestone = await storage.addMilestone({
      ...input,
      escrowId: escrow.id,
    });
    return NextResponse.json(milestone, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
