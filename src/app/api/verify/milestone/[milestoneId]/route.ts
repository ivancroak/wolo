import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { verifyContract } from "@/server/verification";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "verify-milestone", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { milestoneId } = await params;
  const milestone = await storage.getMilestone(Number(milestoneId));
  if (!milestone) {
    return NextResponse.json({ message: "Milestone not found" }, { status: 404 });
  }

  const escrow = await storage.getEscrow(milestone.escrowId);
  if (!escrow) {
    return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
  }

  if (escrow.depositorId !== user.id) {
    return NextResponse.json({ message: "Only the buyer can verify milestones" }, { status: 403 });
  }

  const order = await storage.getOrder(escrow.orderId);
  if (!order) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  const service = await storage.getService(order.serviceId);
  if (!service) {
    return NextResponse.json({ message: "Service not found" }, { status: 404 });
  }

  const sellerProfile = await storage.getProfile(escrow.receiverId);
  if (!sellerProfile?.twitterHandle) {
    return NextResponse.json({
      status: "error",
      message: "Seller has not set their X handle in their profile",
    });
  }
  if (!sellerProfile.twitterVerified) {
    return NextResponse.json(
      { message: "Seller's X handle has not been verified. Cannot run oracle." },
      { status: 400 },
    );
  }

  const effectiveKeyword = order.negotiatedRequiredKeyword ?? order.requiredKeyword;
  const effectiveService = {
    ...service,
    minPostCount: order.negotiatedMinPostCount ?? service.minPostCount,
    postsPerPeriod: order.negotiatedPostsPerPeriod ?? service.postsPerPeriod,
    threadsPerPeriod: order.negotiatedThreadsPerPeriod ?? service.threadsPerPeriod,
  };

  const result = await verifyContract(effectiveService, sellerProfile.twitterHandle, order.createdAt, effectiveKeyword);

  return NextResponse.json(result);
}
