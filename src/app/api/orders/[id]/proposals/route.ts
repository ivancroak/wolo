import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { checkRateLimit } from "@/server/with-rate-limit";
import { notify } from "@/server/notifications";
import { insertDealProposalSchema } from "@shared/schema";
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
  { params }: { params: Promise<{ id: string }> },
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

  const proposals = await storage.getProposals(Number(id));
  return NextResponse.json(proposals);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip, "create-proposal", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const orderId = Number(id);
  const check = await verifyParticipant(orderId, user.id);
  if ("error" in check) {
    return NextResponse.json({ message: check.error }, { status: check.status });
  }

  const { order, service } = check;

  if (order.status === "completed" || order.status === "cancelled") {
    return NextResponse.json({ message: "Cannot propose changes on a closed order" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const input = insertDealProposalSchema.omit({ orderId: true }).parse(body);

    // Check at least one field is proposed
    const hasProposal = input.proposedPrice != null ||
      input.proposedDeadlineDays != null ||
      input.proposedMinPostCount != null ||
      input.proposedPostsPerPeriod != null ||
      input.proposedThreadsPerPeriod != null ||
      input.proposedContentType != null ||
      input.proposedRequiredKeyword != null;

    if (!hasProposal) {
      return NextResponse.json({ message: "At least one proposed field must be provided" }, { status: 400 });
    }

    // Check no pending proposal
    const pending = await storage.getPendingProposal(orderId);
    if (pending) {
      return NextResponse.json({ message: "There is already a pending proposal for this order" }, { status: 409 });
    }

    const proposal = await storage.createProposal({
      ...input,
      orderId,
      proposerId: user.id,
    });

    // Notify counterparty
    const counterpartyId = user.id === order.buyerId ? service.creatorId : order.buyerId;
    const counterpartyProfile = await storage.getProfile(counterpartyId);
    await notify(
      counterpartyId,
      "proposal_created",
      "New Deal Proposal",
      "A new deal proposal has been submitted for your review",
      `/orders/${orderId}`,
      counterpartyProfile?.email ?? undefined,
      counterpartyProfile?.emailVerified && counterpartyProfile?.emailNotifications,
    );

    return NextResponse.json(proposal, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
