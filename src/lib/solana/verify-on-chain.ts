import { Connection, PublicKey } from "@solana/web3.js";
import { WolandEscrowClient } from "./escrow-client";
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

export function getSolanaConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL not set");
  return new Connection(rpcUrl, "confirmed");
}

/**
 * Reads the current escrow phase directly from the on-chain PDA.
 * Returns the phase if the account exists, or null if it doesn't.
 */
export async function readOnChainEscrowPhase(
  depositorWalletAddress: string,
  escrowId: number,
): Promise<EscrowPhase | null> {
  const connection = getSolanaConnection();
  const depositorPubkey = new PublicKey(depositorWalletAddress);
  const escrowPDA = WolandEscrowClient.getEscrowPDAForDepositor(depositorPubkey, escrowId);

  const accountInfo = await connection.getAccountInfo(escrowPDA);
  if (!accountInfo) return null;

  const ESCROW_PROGRAM_ID =
    process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID || "9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9";
  if (accountInfo.owner.toBase58() !== ESCROW_PROGRAM_ID) return null;

  // SOL-only layout: disc(8) + id(8) + depositor(32) + receiver(32) + amount(8) + released(8) + phase(1)
  const PHASE_OFFSET = 96;
  const phaseByte = accountInfo.data[PHASE_OFFSET];
  return PHASE_MAP[phaseByte] ?? null;
}
