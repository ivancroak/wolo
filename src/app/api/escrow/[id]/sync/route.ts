import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { z } from "zod";
const syncInputSchema = z.object({
  onChainPhase: z.enum([
    "awaiting_deposit",
    "funded",
    "in_progress",
    "under_review",
    "milestone_check",
    "released",
    "refunded",
    "disputed",
  ]),
  txHash: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const escrow = await storage.getEscrow(Number(params.id));
  if (!escrow) {
    return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
  }

  if (escrow.depositorId !== user.id && escrow.receiverId !== user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const input = syncInputSchema.parse(body);

    // If on-chain phase matches off-chain, no update needed
    if (escrow.phase === input.onChainPhase) {
      return NextResponse.json(escrow);
    }

    // Desync detected — update DB to match on-chain state
    const updated = await storage.updateEscrowPhase(
      escrow.id,
      input.onChainPhase,
      input.txHash,
    );

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    throw err;
  }
}
