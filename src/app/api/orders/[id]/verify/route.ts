import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { verifyContract } from "@/server/verification";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "verify-contract", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    return NextResponse.json({ message: "Invalid order ID" }, { status: 400 });
  }

  const order = await storage.getOrder(orderId);
  if (!order) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  if (order.buyerId !== user.id) {
    return NextResponse.json({ message: "Only the buyer can verify this contract" }, { status: 403 });
  }

  const service = await storage.getService(order.serviceId);
  if (!service) {
    return NextResponse.json({ message: "Service not found" }, { status: 404 });
  }

  const sellerProfile = await storage.getProfile(service.creatorId);
  if (!sellerProfile?.twitterHandle) {
    return NextResponse.json({ message: "Seller does not have a verified X handle" }, { status: 400 });
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
