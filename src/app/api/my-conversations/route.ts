import { NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [buyerOrders, sellerOrders] = await Promise.all([
    storage.getOrdersByBuyer(user.id),
    storage.getOrdersBySeller(user.id),
  ]);

  const seen = new Set<number>();
  const conversations: {
    orderId: number;
    serviceId: number;
    serviceTitle: string;
    counterpartyId: string;
    counterpartyHandle: string | null;
    role: "buyer" | "seller";
    orderStatus: string;
    createdAt: string | null;
  }[] = [];

  const enrich = async (orders: typeof buyerOrders, role: "buyer" | "seller") => {
    for (const order of orders) {
      if (seen.has(order.id)) continue;
      seen.add(order.id);

      const service = await storage.getService(order.serviceId);
      if (!service) continue;

      const counterpartyId = role === "buyer" ? service.creatorId : order.buyerId;
      const profile = await storage.getProfile(counterpartyId);

      conversations.push({
        orderId: order.id,
        serviceId: order.serviceId,
        serviceTitle: service.title,
        counterpartyId,
        counterpartyHandle: profile?.twitterHandle ?? null,
        role,
        orderStatus: order.status,
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
      });
    }
  };

  await enrich(buyerOrders, "buyer");
  await enrich(sellerOrders, "seller");

  conversations.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json(conversations);
}
