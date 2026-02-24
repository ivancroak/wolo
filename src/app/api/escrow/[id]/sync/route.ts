import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import type { EscrowPhase } from "@shared/schema";

const PHASE_MAP: Record<number, EscrowPhase> = {
  0: "awaiting_deposit",
  1: "funded",
  2: "in_progress",
  3: "under_review",
  4: "milestone_check",
  5: "released",
  6: "refunded",
  7: "disputed",
};

function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL not set");
  return new Connection(rpcUrl, "confirmed");
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const escrow = await storage.getEscrow(Number(id));
  if (!escrow) {
    return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
  }

  if (escrow.depositorId !== user.id && escrow.receiverId !== user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  try {
    const connection = getConnection();
    const depositorPubkey = new PublicKey(escrow.depositorId);
    const escrowPDA = WolandEscrowClient.getEscrowPDAForDepositor(depositorPubkey, escrow.id);

    const accountInfo = await connection.getAccountInfo(escrowPDA);
    if (!accountInfo) {
      return NextResponse.json({ message: "On-chain escrow account not found" }, { status: 404 });
    }

    // Escrow layout: discriminator(8) + id(8) + depositor(32) + receiver(32) + mint(32) + amount(8) + released(8) + phase(1)
    const PHASE_OFFSET = 128;
    const phaseByte = accountInfo.data[PHASE_OFFSET];
    const onChainPhase = PHASE_MAP[phaseByte];
    if (!onChainPhase) {
      return NextResponse.json({ message: "Unknown on-chain phase" }, { status: 500 });
    }

    if (escrow.phase === onChainPhase) {
      return NextResponse.json(escrow);
    }

    const updated = await storage.updateEscrowPhase(escrow.id, onChainPhase);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message ?? "Failed to sync escrow" },
      { status: 500 },
    );
  }
}
