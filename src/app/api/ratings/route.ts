import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { notify } from "@/server/notifications";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimitResponse = checkRateLimit(ip, "submit-rating", 10, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = api.reputation.rate.input.parse(body);

    if (input.targetId === user.id) {
      return NextResponse.json({ message: "Cannot rate yourself" }, { status: 400 });
    }

    const order = await storage.getOrder(input.orderId);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 400 });
    }

    if (order.status !== "completed") {
      return NextResponse.json({ message: "Can only rate completed orders" }, { status: 400 });
    }

    const service = await storage.getService(order.serviceId);
    if (!service) {
      return NextResponse.json({ message: "Service not found" }, { status: 400 });
    }

    const isBuyer = order.buyerId === user.id;
    const isSeller = service.creatorId === user.id;
    if (!isBuyer && !isSeller) {
      return NextResponse.json({ message: "Only order participants can rate" }, { status: 403 });
    }

    const counterparty = isBuyer ? service.creatorId : order.buyerId;
    if (input.targetId !== counterparty) {
      return NextResponse.json({ message: "Can only rate the counterparty of this order" }, { status: 400 });
    }

    const existingRatings = await storage.getRatings(input.targetId);
    const alreadyRated = existingRatings.some(
      r => r.orderId === input.orderId && r.raterId === user.id
    );
    if (alreadyRated) {
      return NextResponse.json({ message: "You have already rated this order" }, { status: 400 });
    }

    const rating = await storage.addRating({
      ...input,
      raterId: user.id,
    });

    await notify(
      rating.targetId,
      "rating_received",
      "New Rating",
      `You received a ${rating.score}-star rating`,
      "/dashboard",
    );

    return NextResponse.json(rating, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
