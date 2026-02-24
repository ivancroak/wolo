import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { notify } from "@/server/notifications";
import { checkRateLimit } from "@/server/with-rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
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

    const order = await storage.createOrder({
      ...input,
      buyerId: user.id,
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
    throw err;
  }
}
