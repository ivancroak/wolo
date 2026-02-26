import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { checkRateLimit } from "@/server/with-rate-limit";
import { verifyDelivery } from "@/server/verification";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip, "dispute-action", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id, actionId } = await params;
  const serviceId = Number(id);
  const completionId = Number(actionId);

  const service = await storage.getService(serviceId);
  if (!service) {
    return NextResponse.json({ message: "Service not found" }, { status: 404 });
  }

  if (service.creatorId !== user.id) {
    return NextResponse.json({ message: "Only the listing creator can dispute actions" }, { status: 403 });
  }

  const completion = await storage.getActionCompletion(completionId);
  if (!completion || completion.serviceId !== serviceId) {
    return NextResponse.json({ message: "Action completion not found" }, { status: 404 });
  }

  if (completion.status !== "completed") {
    return NextResponse.json({ message: `Action already ${completion.status}` }, { status: 400 });
  }

  // Get the completer's profile for their twitter handle
  const completerProfile = await storage.getProfile(completion.userId);
  const completerHandle = completerProfile?.twitterHandle;
  if (!completerHandle) {
    return NextResponse.json({
      message: "Completer has no Twitter handle on file — manual review required",
      verification: { status: "manual_only", message: "No Twitter handle" },
    }, { status: 200 });
  }

  const body = await request.json().catch(() => ({}));
  const { tweetUrl, targetHandle } = body as { tweetUrl?: string; targetHandle?: string };

  const result = await verifyDelivery(service.category, completerHandle, { tweetUrl, targetHandle });

  if (result.status === "verified") {
    const updated = await storage.updateActionCompletionStatus(completionId, "verified");
    return NextResponse.json({ completion: updated, verification: result });
  }

  if (result.status === "not_found") {
    const updated = await storage.updateActionCompletionStatus(completionId, "rejected");
    return NextResponse.json({ completion: updated, verification: result });
  }

  // manual_only or error — don't change status
  return NextResponse.json({ completion, verification: result });
}
