import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import type { OrderStatus } from "@shared/schema";

const VALID_ORDER_TRANSITIONS: Record<OrderStatus, { status: OrderStatus; by: "buyer" | "seller" | "both" }[]> = {
  pending: [
    { status: "completed", by: "seller" },
    { status: "disputed", by: "buyer" },
    { status: "cancelled", by: "both" },
  ],
  completed: [],
  disputed: [
    { status: "completed", by: "both" },
    { status: "cancelled", by: "both" },
  ],
  cancelled: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const input = api.orders.update.input.parse(body);

    const order = await storage.getOrder(Number(id));
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const service = await storage.getService(order.serviceId);
    if (!service) {
      return NextResponse.json({ message: "Service not found" }, { status: 404 });
    }

    const isSeller = service.creatorId === user.id;
    const isBuyer = order.buyerId === user.id;

    if (!isSeller && !isBuyer) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    if (input.status) {
      const allowed = VALID_ORDER_TRANSITIONS[order.status] ?? [];
      const rule = allowed.find(r => r.status === input.status);
      if (!rule) {
        return NextResponse.json({
          message: `Cannot transition from '${order.status}' to '${input.status}'`,
        }, { status: 400 });
      }
      if (rule.by === "buyer" && !isBuyer) {
        return NextResponse.json({ message: "Only the buyer can perform this action" }, { status: 403 });
      }
      if (rule.by === "seller" && !isSeller) {
        return NextResponse.json({ message: "Only the seller can perform this action" }, { status: 403 });
      }
    }

    const updatedOrder = await storage.updateOrder(Number(id), input);
    return NextResponse.json(updatedOrder);
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
