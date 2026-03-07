import { NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const orders = await storage.getOrdersByBuyer(user.id);

  // Enrich with service title, seller twitter handle, and escrow phase
  const serviceIds = Array.from(new Set(orders.map((o) => o.serviceId)));
  const serviceMap = new Map<number, { title: string; creatorId: string }>();
  for (const sid of serviceIds) {
    const svc = await storage.getService(sid);
    if (svc) serviceMap.set(sid, { title: svc.title, creatorId: svc.creatorId });
  }

  const sellerIds = Array.from(new Set(Array.from(serviceMap.values()).map((s) => s.creatorId)));
  const handleMap = new Map<string, string | null>();
  for (const uid of sellerIds) {
    const profile = await storage.getProfile(uid);
    handleMap.set(uid, profile?.twitterHandle ?? null);
  }

  const enriched = await Promise.all(orders.map(async (o) => {
    const svc = serviceMap.get(o.serviceId);
    const escrow = o.escrowId ? await storage.getEscrow(o.escrowId) : null;
    return {
      ...o,
      serviceTitle: svc?.title ?? `Service #${o.serviceId}`,
      sellerTwitterHandle: svc ? (handleMap.get(svc.creatorId) ?? null) : null,
      escrowPhase: escrow?.phase ?? null,
    };
  }));

  return NextResponse.json(enriched);
}
