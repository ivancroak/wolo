import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import type { EscrowPhase } from "@shared/schema";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

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

const SYNC_ALLOWED_TRANSITIONS: Record<string, EscrowPhase[]> = {
  awaiting_deposit: ["funded"],
  funded: ["in_progress", "disputed", "refunded"],
  in_progress: ["under_review", "milestone_check", "disputed", "refunded"],
  under_review: ["released", "disputed", "refunded"],
  milestone_check: ["in_progress", "released", "disputed", "refunded"],
  disputed: ["released", "refunded"],
  released: [],
  refunded: [],
};

function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL not set");
  return new Connection(rpcUrl, "confirmed");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "escrow-sync", 10, 60000);
  if (rl) return rl;

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
    const depositorProfile = await storage.getProfile(escrow.depositorId);
    if (!depositorProfile?.walletAddress) {
      return NextResponse.json({ message: "Depositor has no wallet address configured" }, { status: 400 });
    }
    const depositorPubkey = new PublicKey(depositorProfile.walletAddress);
    const escrowPDA = WolandEscrowClient.getEscrowPDAForDepositor(depositorPubkey, escrow.id);

    const accountInfo = await connection.getAccountInfo(escrowPDA);
    if (!accountInfo) {
      return NextResponse.json({ message: "On-chain escrow account not found" }, { status: 404 });
    }

    const ESCROW_PROGRAM_ID = process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID || "9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9";
    if (accountInfo.owner.toBase58() !== ESCROW_PROGRAM_ID) {
      return NextResponse.json({ message: "Account not owned by escrow program" }, { status: 400 });
    }

    // SOL-only layout: disc(8) + id(8) + depositor(32) + receiver(32) + amount(8) + released(8) + phase(1)
    const PHASE_OFFSET = 96;
    const phaseByte = accountInfo.data[PHASE_OFFSET];
    const onChainPhase = PHASE_MAP[phaseByte];
    if (!onChainPhase) {
      return NextResponse.json({ message: "Unknown on-chain phase" }, { status: 500 });
    }

    if (escrow.phase === onChainPhase) {
      return NextResponse.json(escrow);
    }

    const allowed = SYNC_ALLOWED_TRANSITIONS[escrow.phase] ?? [];
    if (!allowed.includes(onChainPhase)) {
      return NextResponse.json({
        message: `Cannot sync from '${escrow.phase}' to '${onChainPhase}'`,
      }, { status: 400 });
    }

    const updated = await storage.updateEscrowPhase(escrow.id, onChainPhase);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { message: "Failed to sync escrow" },
      { status: 500 },
    );
  }
}
