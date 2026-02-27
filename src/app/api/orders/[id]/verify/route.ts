import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { verifyContract } from "@/server/verification";
import { checkRateLimit } from "@/server/with-rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
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

  const result = await verifyContract(service, sellerProfile.twitterHandle, order.createdAt);

  return NextResponse.json(result);
}
