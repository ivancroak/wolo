import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = api.escrow.updateMilestone.input.parse(body);

    const milestone = await storage.getMilestone(Number(params.id));
    if (!milestone) {
      return NextResponse.json({ message: "Milestone not found" }, { status: 404 });
    }

    const escrow = await storage.getEscrow(milestone.escrowId);
    if (!escrow) {
      return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
    }

    if (escrow.depositorId !== user.id && escrow.receiverId !== user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    if (input.status === "approved" || input.status === "rejected") {
      if (escrow.depositorId !== user.id) {
        return NextResponse.json({ message: "Only the depositor can approve/reject milestones" }, { status: 403 });
      }
    }
    if (input.status === "submitted") {
      if (escrow.receiverId !== user.id) {
        return NextResponse.json({ message: "Only the receiver can submit milestones" }, { status: 403 });
      }
    }

    const updated = await storage.updateMilestoneStatus(
      Number(params.id),
      input.status,
      input.proofUrl,
    );
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    throw err;
  }
}
