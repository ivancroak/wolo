import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { notify } from "@/server/notifications";
import { checkSessionRateLimit } from "@/server/with-rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rl = checkSessionRateLimit(user.id, "period-dispute", 10, 60000);
  if (rl) return rl;

  const { id, periodId } = await params;
  const escrowId = parseInt(id, 10);
  const pId = parseInt(periodId, 10);
  if (isNaN(escrowId) || isNaN(pId)) {
    return NextResponse.json({ message: "Invalid IDs" }, { status: 400 });
  }

  try {
    const escrow = await storage.getEscrow(escrowId);
    if (!escrow) {
      return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
    }

    if (user.id !== escrow.depositorId) {
      return NextResponse.json({ message: "Only the depositor can dispute a period" }, { status: 403 });
    }

    const period = await storage.getPayrollPeriod(pId);
    if (!period || period.escrowId !== escrowId) {
      return NextResponse.json({ message: "Period not found" }, { status: 404 });
    }

    if (period.status !== "active" && period.status !== "delivered") {
      return NextResponse.json({ message: "Period cannot be disputed in its current status" }, { status: 400 });
    }

    if (new Date() > period.disputeDeadline) {
      return NextResponse.json({ message: "Dispute deadline has passed" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;

    const updated = await storage.updatePayrollPeriodStatus(pId, "disputed", {
      disputedBy: user.id,
      disputeReason: reason,
    });

    const link = `/orders/${escrow.orderId}`;
    await notify(
      escrow.receiverId,
      "payroll_period_disputed",
      "Period Disputed",
      `Period ${period.periodNumber} has been disputed by the buyer.${reason ? ` Reason: ${reason}` : ""}`,
      link,
    );

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
