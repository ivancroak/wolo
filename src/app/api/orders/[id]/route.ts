import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import type { OrderStatus } from "@shared/schema";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";
import { readOnChainEscrowPhase } from "@/lib/solana/verify-on-chain";
import { notify } from "@/server/notifications";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const order = await storage.getOrder(Number(id));
  if (!order) {
    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  }

  const service = await storage.getService(order.serviceId);
  const isBuyer = order.buyerId === user.id;
  const isSeller = service?.creatorId === user.id;

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  // Enrich with service title and twitter handles
  const buyerProfile = await storage.getProfile(order.buyerId);
  const sellerProfile = service ? await storage.getProfile(service.creatorId) : null;

  return NextResponse.json({
    ...order,
    serviceTitle: service?.title ?? `Service #${order.serviceId}`,
    buyerTwitterHandle: buyerProfile?.twitterHandle ?? null,
    sellerTwitterHandle: sellerProfile?.twitterHandle ?? null,
  });
}

const VALID_ORDER_TRANSITIONS: Record<OrderStatus, { status: OrderStatus; by: "buyer" | "seller" | "both" }[]> = {
  pending_approval: [
    { status: "pending", by: "seller" },   // Service creator accepts the applicant
    { status: "cancelled", by: "both" },    // Either party can cancel/withdraw
  ],
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
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "update-order", 30, 60000);
  if (rl) return rl;

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

      // Prevent marking an order "completed" when escrow funds haven't been released on-chain
      if (input.status === "completed") {
        const escrow = await storage.getEscrowByOrder(Number(id));
        if (escrow) {
          // Verify on-chain state, not just DB, to prevent spoofed DB phase
          const depositorProfile = await storage.getProfile(escrow.depositorId);
          if (depositorProfile?.walletAddress) {
            try {
              const onChainPhase = await readOnChainEscrowPhase(depositorProfile.walletAddress, escrow.id);
              if (onChainPhase !== null && onChainPhase !== "released") {
                return NextResponse.json({
                  message: `Cannot complete order: on-chain escrow is '${onChainPhase}', not 'released'. Release funds first.`,
                }, { status: 400 });
              }
            } catch {
              // Fallback to DB check if on-chain verification fails
              if (escrow.phase !== "released") {
                return NextResponse.json({
                  message: "Cannot complete order while escrow is active. Release funds on the order page first.",
                }, { status: 400 });
              }
            }
          } else if (escrow.phase !== "released") {
            return NextResponse.json({
              message: "Cannot complete order while escrow is active. Release funds on the order page first.",
            }, { status: 400 });
          }
        }
      }

      // Prevent cancelling an order when escrow has funds locked on-chain
      if (input.status === "cancelled") {
        const escrow = await storage.getEscrowByOrder(Number(id));
        if (escrow && escrow.phase !== "awaiting_deposit" && escrow.phase !== "released" && escrow.phase !== "refunded") {
          return NextResponse.json({
            message: "Cannot cancel order with funded escrow. Resolve the escrow on the order page first.",
          }, { status: 400 });
        }
      }

      // When accepting an applicant for a request listing (pending_approval → pending):
      // 1. Create escrow so the requester can fund it
      // 2. Cancel other pending_approval orders for the same service
      if (order.status === "pending_approval" && input.status === "pending") {
        const effectivePrice = order.negotiatedPrice ?? service.price;
        const escrowInput: any = {
          orderId: order.id,
          depositorId: service.creatorId,   // requester pays
          receiverId: order.buyerId,         // applicant receives
          amount: effectivePrice,
          expiresInDays: order.negotiatedDeadlineDays ?? service.deadlineDays ?? 7,
        };

        if (service.pricingCategory === "payroll") {
          const basis = service.payrollBasis ?? "weekly";
          // Default to 4 periods if not negotiated
          const totalPeriods = 4;
          const totalAmount = (Number(effectivePrice) * totalPeriods).toFixed(9).replace(/\.?0+$/, "");
          const periodDays = basis === "weekly" ? 7 : 30;
          escrowInput.amount = totalAmount;
          escrowInput.expiresInDays = Math.min(periodDays * totalPeriods + 30, 365);
          escrowInput.isRecurring = true;
          escrowInput.payrollBasis = basis;
          escrowInput.totalPeriods = totalPeriods;
          escrowInput.amountPerPeriod = effectivePrice;
        }

        await storage.createEscrow(escrowInput);

        // Cancel other pending_approval orders for the same service
        await storage.cancelPendingApprovalOrders(order.serviceId, order.id);

        // Notify the accepted applicant
        await notify(
          order.buyerId,
          "order_created",
          "Application Accepted",
          `Your application for "${service.title}" has been accepted! The requester will fund the escrow.`,
          `/orders/${order.id}`,
        );
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
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
