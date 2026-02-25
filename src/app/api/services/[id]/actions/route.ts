import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { checkRateLimit } from "@/server/with-rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip, "complete-action", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const service = await storage.getService(Number(id));
  if (!service) {
    return NextResponse.json({ message: "Service not found" }, { status: 404 });
  }

  if (service.pricingCategory !== "pay_per_action") {
    return NextResponse.json({ message: "This service is not pay-per-action" }, { status: 400 });
  }

  if (!service.active) {
    return NextResponse.json({ message: "This service is no longer active (fulfilled)" }, { status: 400 });
  }

  if (service.creatorId === user.id) {
    return NextResponse.json({ message: "Cannot complete your own service action" }, { status: 400 });
  }

  if (service.maxActions != null && service.actionsCompleted >= service.maxActions) {
    return NextResponse.json({ message: "All actions have been completed" }, { status: 400 });
  }

  const alreadyDone = await storage.hasCompletedAction(Number(id), user.id);
  if (alreadyDone) {
    return NextResponse.json({ message: "You have already completed this action" }, { status: 400 });
  }

  try {
    const completion = await storage.recordActionCompletion(Number(id), user.id);

    // Calculate per-action payout
    const payoutPerAction = service.maxActions
      ? (parseFloat(service.budgetCap || service.price) / service.maxActions).toFixed(6)
      : service.price;

    return NextResponse.json({
      ...completion,
      payoutPerAction,
      actionsCompleted: service.actionsCompleted + 1,
      maxActions: service.maxActions,
    }, { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes("duplicate key") || err?.message?.includes("unique")) {
      return NextResponse.json({ message: "You have already completed this action" }, { status: 400 });
    }
    throw err;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const completions = await storage.getActionCompletions(Number(id));
  return NextResponse.json(completions);
}
