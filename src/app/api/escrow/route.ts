import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { checkRateLimit } from "@/server/with-rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip, "create-escrow", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = api.escrow.create.input.parse(body);

    const order = await storage.getOrder(input.orderId);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 400 });
    }

    if (order.buyerId !== user.id) {
      return NextResponse.json({ message: "Only the buyer can create an escrow" }, { status: 403 });
    }

    const service = await storage.getService(order.serviceId);
    if (!service) {
      return NextResponse.json({ message: "Service not found" }, { status: 400 });
    }

    if (user.id === service.creatorId) {
      return NextResponse.json({ message: "Cannot create escrow for your own service" }, { status: 400 });
    }

    const expectedReceiver = service.listingType === "request" ? order.buyerId : service.creatorId;
    if (input.receiverId !== expectedReceiver) {
      return NextResponse.json({ message: "Receiver does not match service creator" }, { status: 400 });
    }

    if (input.amount !== service.price) {
      return NextResponse.json({ message: "Amount does not match service price" }, { status: 400 });
    }

    const existingEscrow = await storage.getEscrowByOrder(input.orderId);
    if (existingEscrow) {
      return NextResponse.json({ message: "Escrow already exists for this order" }, { status: 400 });
    }

    const escrow = await storage.createEscrow({
      ...input,
      depositorId: user.id,
    });

    return NextResponse.json(escrow, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
