import { NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const orders = await storage.getOrdersBySeller(user.id);

  // Enrich with service title, buyer twitter handle, and escrow phase
  const serviceIds = Array.from(new Set(orders.map((o) => o.serviceId)));
  const serviceMap = new Map<number, string>();
  for (const sid of serviceIds) {
    const svc = await storage.getService(sid);
    if (svc) serviceMap.set(sid, svc.title);
  }

  const buyerIds = Array.from(new Set(orders.map((o) => o.buyerId)));
  const handleMap = new Map<string, string | null>();
  for (const uid of buyerIds) {
    const profile = await storage.getProfile(uid);
    handleMap.set(uid, profile?.twitterHandle ?? null);
  }

  const enriched = await Promise.all(orders.map(async (o) => {
    const escrow = o.escrowId ? await storage.getEscrow(o.escrowId) : null;
    return {
      ...o,
      serviceTitle: serviceMap.get(o.serviceId) ?? `Service #${o.serviceId}`,
      buyerTwitterHandle: handleMap.get(o.buyerId) ?? null,
      escrowPhase: escrow?.phase ?? null,
    };
  }));

  return NextResponse.json(enriched);
}
