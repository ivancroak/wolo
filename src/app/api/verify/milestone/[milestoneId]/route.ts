import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { verifyDelivery } from "@/server/verification";
import type { ServiceCategory } from "@shared/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: { milestoneId: string } },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const milestone = await storage.getMilestone(Number(params.milestoneId));
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

  const searchParams = request.nextUrl.searchParams;
  const tweetUrl = searchParams.get("tweetUrl") ?? undefined;
  const targetHandle = searchParams.get("targetHandle") ?? undefined;

  const result = await verifyDelivery(
    service.category as ServiceCategory,
    sellerProfile.twitterHandle,
    { tweetUrl, targetHandle },
  );

  return NextResponse.json(result);
}
