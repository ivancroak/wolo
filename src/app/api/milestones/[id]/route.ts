import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { notify } from "@/server/notifications";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "update-milestone", 20, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const input = api.escrow.updateMilestone.input.parse(body);

    const milestone = await storage.getMilestone(Number(id));
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
      Number(id),
      input.status,
      input.proofUrl,
    );

    const targetId = user.id === escrow.depositorId ? escrow.receiverId : escrow.depositorId;
    const statusNotifications: Record<string, { type: "milestone_submitted" | "milestone_approved"; body: string }> = {
      submitted: { type: "milestone_submitted", body: "A milestone has been submitted for review" },
      approved: { type: "milestone_approved", body: "Your milestone has been approved" },
    };
    const info = statusNotifications[input.status];
    if (info) {
      await notify(targetId, info.type, "Milestone Update", info.body, "/dashboard");
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
