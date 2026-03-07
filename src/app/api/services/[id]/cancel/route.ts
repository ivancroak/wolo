import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { checkSessionRateLimit } from "@/server/with-rate-limit";
import { notify } from "@/server/notifications";
import type { EscrowPhase } from "@shared/schema";

const FUNDED_PHASES: EscrowPhase[] = [
  "funded",
  "in_progress",
  "milestone_check",
  "under_review",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkSessionRateLimit(user.id, "service-cancel", 5, 60000);
  if (rl) return rl;

  const { id } = await params;
  const serviceId = parseInt(id);
  if (isNaN(serviceId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const service = await storage.getService(serviceId);
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (service.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const orders = await storage.getOrdersByServiceId(serviceId);
    const activeOrders = orders.filter(
      (o) => o.status !== "cancelled" && o.status !== "completed",
    );

    // For request listings, block cancellation if any order has a funded escrow
    if (service.listingType === "request") {
      for (const order of activeOrders) {
        if (order.escrowId) {
          const escrow = await storage.getEscrow(order.escrowId);
          if (escrow && FUNDED_PHASES.includes(escrow.phase)) {
            return NextResponse.json(
              { error: "Cannot cancel request with funded escrows. Resolve or refund them first." },
              { status: 409 },
            );
          }
        }
      }
    }

    const escrowsToRefund: { escrowId: number; depositorWalletAddress: string }[] = [];
    let ordersAffected = 0;

    for (const order of activeOrders) {
      let escrowNeedsRefund = false;

      if (order.escrowId) {
        const escrow = await storage.getEscrow(order.escrowId);
        if (escrow) {
          if (FUNDED_PHASES.includes(escrow.phase)) {
            // Mark escrow as refunded in DB; on-chain refund handled client-side
            await storage.updateEscrowPhase(escrow.id, "refunded");
            const depositorProfile = await storage.getProfile(escrow.depositorId);
            if (depositorProfile?.walletAddress) {
              escrowsToRefund.push({ escrowId: escrow.id, depositorWalletAddress: depositorProfile.walletAddress });
            }
            escrowNeedsRefund = true;
          }
          // awaiting_deposit or already terminal phases: no refund needed
        }
      }

      await storage.updateOrder(order.id, { status: "cancelled" });
      ordersAffected++;

      // Notify the buyer about the cancellation
      const buyerProfile = await storage.getProfile(order.buyerId);
      await notify(
        order.buyerId,
        "order_cancelled",
        "Order Cancelled",
        `The service "${service.title}" has been cancelled by the seller.${escrowNeedsRefund ? " Your escrow will be refunded." : ""}`,
        `/orders/${order.id}`,
        buyerProfile?.email ?? undefined,
        buyerProfile?.emailNotifications ?? false,
      );
    }

    // Deactivate the service (sets active=false)
    await storage.deleteService(serviceId, user.id);

    return NextResponse.json({
      cancelled: true,
      ordersAffected,
      escrowsToRefund,
    });
  } catch (err) {
    console.error("Service cancel error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
