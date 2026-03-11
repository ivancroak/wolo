import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { notify } from "@/server/notifications";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

async function verifyParticipant(orderId: number, userId: string) {
  const order = await storage.getOrder(orderId);
  if (!order) return { error: "Order not found", status: 404 as const };

  const service = await storage.getService(order.serviceId);
  if (!service) return { error: "Service not found", status: 404 as const };

  const isParticipant = userId === order.buyerId || userId === service.creatorId;
  if (!isParticipant) return { error: "Unauthorized", status: 403 as const };

  return { order, service };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const check = await verifyParticipant(Number(id), user.id);
  if ("error" in check) {
    return NextResponse.json({ message: check.error }, { status: check.status });
  }

  const messages = await storage.getSecureMessages(Number(id), user.id);
  return NextResponse.json(messages);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "send-message", 30, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const check = await verifyParticipant(Number(id), user.id);
  if ("error" in check) {
    return NextResponse.json({ message: check.error }, { status: check.status });
  }

  try {
    const body = await request.json();
    const input = api.messages.send.input.parse(body);

    // Calculate recipientId server-side instead of trusting client input
    const recipientId = user.id === check.order.buyerId
      ? check.service.creatorId
      : check.order.buyerId;

    const msg = await storage.sendSecureMessage({
      ...input,
      recipientId,
      orderId: Number(id),
      senderId: user.id,
    });

    const recipientProfile = await storage.getProfile(recipientId);
    await notify(
      recipientId,
      "message_received",
      "New Message",
      "You have a new message",
      `/orders/${check.order.id}`,
      recipientProfile?.email ?? undefined,
      recipientProfile?.emailVerified && recipientProfile?.emailNotifications,
    );

    return NextResponse.json(msg, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
