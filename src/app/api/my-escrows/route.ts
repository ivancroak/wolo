import { NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const escrows = await storage.getEscrowsByUser(user.id);

  // Collect all unique user IDs to look up wallet addresses
  const userIds = Array.from(new Set(escrows.flatMap(e => [e.depositorId, e.receiverId])));
  const walletMap = new Map<string, string | null>();
  for (const uid of userIds) {
    const profile = await storage.getProfile(uid);
    walletMap.set(uid, profile?.walletAddress || uid);
  }

  const withMilestones = await Promise.all(
    escrows.map(async (e) => {
      const milestones = await storage.getMilestones(e.id);
      const order = await storage.getOrder(e.orderId);
      const service = order ? await storage.getService(order.serviceId) : null;
      return {
        ...e,
        milestones,
        serviceCategory: service?.category ?? null,
        depositorWalletAddress: walletMap.get(e.depositorId) ?? null,
        receiverWalletAddress: walletMap.get(e.receiverId) ?? null,
      };
    })
  );
  return NextResponse.json(withMilestones);
}
