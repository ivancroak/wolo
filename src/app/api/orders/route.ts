import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { notify } from "@/server/notifications";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimitResponse = checkRateLimit(ip, "create-order", 30, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = api.orders.create.input.parse(body);

    const service = await storage.getService(input.serviceId);
    if (!service) {
      return NextResponse.json({ message: "Service not found" }, { status: 404 });
    }

    if (service.creatorId === user.id) {
      return NextResponse.json({ message: "Cannot purchase your own service" }, { status: 400 });
    }

    if (!service.active) {
      return NextResponse.json({ message: "This service is no longer active" }, { status: 400 });
    }

    if (service.maxActions != null && service.actionsCompleted >= service.maxActions) {
      return NextResponse.json({ message: "All contracts for this service have been taken" }, { status: 400 });
    }

    const hasExisting = await storage.hasActiveOrder(input.serviceId, user.id);
    if (hasExisting) {
      return NextResponse.json({ message: "You already have a contract for this service" }, { status: 400 });
    }

    // Require verified profile to purchase
    const profile = await storage.getProfile(user.id);
    if (!profile?.walletAddress || !profile?.twitterHandle || !profile?.twitterVerified) {
      return NextResponse.json(
        { message: "Complete your profile (wallet address + verified X handle) before purchasing." },
        { status: 403 }
      );
    }

    let requiredKeyword: string | null = null;
    if (service.listingType === "offer") {
      if (!input.requiredKeyword?.trim()) {
        return NextResponse.json({ message: "Required keyword is mandatory for offers", field: "requiredKeyword" }, { status: 400 });
      }
      requiredKeyword = input.requiredKeyword.trim();
    } else {
      requiredKeyword = service.requiredKeyword ?? null;
    }

    const order = await storage.createOrder({
      ...input,
      buyerId: user.id,
      requiredKeyword,
    });

    await notify(
      service.creatorId,
      "order_created",
      "New Order",
      `You have a new order for "${service.title}"`,
      `/orders/${order.id}`,
    );

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
