import { NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const escrows = await storage.getEscrowsByUser(user.id);
  const withMilestones = await Promise.all(
    escrows.map(async (e) => ({
      ...e,
      milestones: await storage.getMilestones(e.id),
    }))
  );
  return NextResponse.json(withMilestones);
}
