import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { checkRateLimit } from "@/server/with-rate-limit";
import { notify } from "@/server/notifications";
import { patchDealProposalSchema } from "@shared/schema";
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> },
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip, "patch-proposal", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id, proposalId } = await params;
  const orderId = Number(id);
  const check = await verifyParticipant(orderId, user.id);
  if ("error" in check) {
    return NextResponse.json({ message: check.error }, { status: check.status });
  }

  const { order, service } = check;

  try {
    const body = await request.json();
    const { action } = patchDealProposalSchema.parse(body);

    const proposals = await storage.getProposals(orderId);
    const proposal = proposals.find((p) => p.id === Number(proposalId));
    if (!proposal) {
      return NextResponse.json({ message: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status !== "pending") {
      return NextResponse.json({ message: "Proposal is no longer pending" }, { status: 400 });
    }

    const isProposer = user.id === proposal.proposerId;
    const counterpartyId = user.id === order.buyerId ? service.creatorId : order.buyerId;

    if (action === "withdraw") {
      if (!isProposer) {
        return NextResponse.json({ message: "Only the proposer can withdraw" }, { status: 403 });
      }
      const updated = await storage.updateProposalStatus(proposal.id, "withdrawn");
      return NextResponse.json(updated);
    }

    if (action === "accept" || action === "reject") {
      if (isProposer) {
        return NextResponse.json({ message: "Only the counterparty can accept or reject" }, { status: 403 });
      }

      if (action === "accept") {
        const updated = await storage.updateProposalStatus(proposal.id, "accepted");
        await storage.applyProposalToOrder(orderId, proposal);

        let notifyBody = "Your deal proposal has been accepted";
        if (proposal.proposedPrice != null && order.escrowId) {
          const escrow = await storage.getEscrow(order.escrowId);
          if (escrow && escrow.phase !== "awaiting_deposit") {
            notifyBody = `Deal price changed to ${proposal.proposedPrice} SOL — please adjust your escrow deposit.`;
            const depositorProfile = await storage.getProfile(escrow.depositorId);
            await notify(
              escrow.depositorId,
              "proposal_accepted",
              "Escrow Adjustment Needed",
              notifyBody,
              `/orders/${orderId}`,
              depositorProfile?.email ?? undefined,
              depositorProfile?.emailVerified && depositorProfile?.emailNotifications,
            );
          }
        }

        await notify(
          proposal.proposerId,
          "proposal_accepted",
          "Proposal Accepted",
          notifyBody,
          `/orders/${orderId}`,
        );
        return NextResponse.json(updated);
      }

      // reject
      const updated = await storage.updateProposalStatus(proposal.id, "rejected");
      await notify(
        proposal.proposerId,
        "proposal_rejected",
        "Proposal Declined",
        "Your deal proposal has been declined",
        `/orders/${orderId}`,
      );
      return NextResponse.json(updated);
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
