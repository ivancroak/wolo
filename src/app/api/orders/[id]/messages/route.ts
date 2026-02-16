import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";

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
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const check = await verifyParticipant(Number(params.id), user.id);
  if ("error" in check) {
    return NextResponse.json({ message: check.error }, { status: check.status });
  }

  const messages = await storage.getSecureMessages(Number(params.id), user.id);
  return NextResponse.json(messages);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const check = await verifyParticipant(Number(params.id), user.id);
  if ("error" in check) {
    return NextResponse.json({ message: check.error }, { status: check.status });
  }

  try {
    const body = await request.json();
    const input = api.messages.send.input.parse(body);
    const msg = await storage.sendSecureMessage({
      ...input,
      orderId: Number(params.id),
      senderId: user.id,
    });
    return NextResponse.json(msg, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    throw err;
  }
}
