import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const escrow = await storage.getEscrowByOrder(Number(id));
  if (!escrow) {
    return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
  }

  // Fix legacy escrows where depositorId === receiverId for request listings
  // For request listings, depositor should be the service creator, receiver should be the buyer
  if (escrow.depositorId === escrow.receiverId) {
    const order = await storage.getOrder(Number(id));
    if (order) {
      const service = await storage.getService(order.serviceId);
      if (service && service.listingType === "request") {
        const correctDepositor = service.creatorId;
        const correctReceiver = order.buyerId;
        if (correctDepositor !== correctReceiver) {
          await storage.fixEscrowParties(escrow.id, correctDepositor, correctReceiver);
          escrow.depositorId = correctDepositor;
          escrow.receiverId = correctReceiver;
        }
      }
    }
  }

  if (escrow.depositorId !== user.id && escrow.receiverId !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const milestones = await storage.getMilestones(escrow.id);

  // Enrich with wallet addresses for on-chain transactions
  // User ID is the wallet address (set at login), profile.walletAddress is optional override
  const depositorProfile = await storage.getProfile(escrow.depositorId);
  const receiverProfile = await storage.getProfile(escrow.receiverId);
  const enriched = {
    ...escrow,
    depositorWalletAddress: depositorProfile?.walletAddress || escrow.depositorId,
    receiverWalletAddress: receiverProfile?.walletAddress || escrow.receiverId,
  };

  return NextResponse.json({ escrow: enriched, milestones });
}
