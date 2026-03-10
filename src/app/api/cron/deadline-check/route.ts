import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { storage } from "@/server/storage";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";
import { notify } from "@/server/notifications";

function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL not set");
  return new Connection(rpcUrl, "confirmed");
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const results = { refunded: 0, errors: [] as string[] };

  try {
    const expired = await storage.getExpiredEscrows();
    if (expired.length === 0) {
      return NextResponse.json({ ...results, message: "OK, no expired escrows" });
    }

    const connection = getConnection();
    const deployWallet = getDeployWalletKeypair();
    const client = new WolandEscrowClient(connection, deployWallet.publicKey);

    for (const escrow of expired) {
      try {
        // Check milestones — approved ones are already paid out on-chain
        const milestones = await storage.getMilestones(escrow.id);
        const approvedCount = milestones.filter((m) => m.status === "approved").length;
        const totalCount = milestones.length;

        // If all milestones are approved, the escrow should already be released.
        // This shouldn't happen since we query for non-released escrows, but guard anyway.
        if (totalCount > 0 && approvedCount === totalCount) {
          await storage.updateEscrowPhase(escrow.id, "released");
          continue;
        }

        // Refund remaining balance to depositor.
        // Approved milestone amounts are already paid out on-chain,
        // so buildRefundIx returns whatever SOL is left in the escrow PDA.
        const depositorProfile = await storage.getProfile(escrow.depositorId);
        const depositorWallet = depositorProfile?.walletAddress || escrow.depositorId;

        let depositorPubkey: PublicKey;
        try {
          depositorPubkey = new PublicKey(depositorWallet);
        } catch {
          results.errors.push(`escrow ${escrow.id}: invalid depositor wallet "${depositorWallet}"`);
          continue;
        }

        const ix = await client.buildRefundIx(depositorPubkey, escrow.id);
        const { tx } = await client.buildTransaction([ix]);
        tx.sign(deployWallet);

        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, "confirmed");

        await storage.updateEscrowPhase(escrow.id, "refunded", sig);

        // Notify both parties
        const link = `/orders/${escrow.orderId}`;
        const hasPartialWork = approvedCount > 0;

        if (hasPartialWork) {
          await notify(
            escrow.depositorId,
            "escrow_released",
            "Deadline Expired — Partial Refund",
            `${approvedCount} of ${totalCount} milestones were completed. Remaining funds refunded to you.`,
            link,
          );
          await notify(
            escrow.receiverId,
            "escrow_released",
            "Deadline Expired",
            `${approvedCount} of ${totalCount} milestones were completed. Remaining escrow funds returned to buyer.`,
            link,
          );
        } else {
          await notify(
            escrow.depositorId,
            "escrow_released",
            "Deadline Expired — Full Refund",
            totalCount > 0
              ? `No milestones were completed by the deadline. Full refund issued.`
              : `Service deadline expired. Full refund issued.`,
            link,
          );
          await notify(
            escrow.receiverId,
            "escrow_released",
            "Deadline Expired",
            totalCount > 0
              ? `No milestones were completed by the deadline. Escrow refunded to buyer.`
              : `Service deadline expired. Escrow refunded to buyer.`,
            link,
          );
        }

        results.refunded++;
      } catch (err: any) {
        results.errors.push(`escrow ${escrow.id}: ${err.message}`);
      }
    }

    return NextResponse.json({ ...results, message: "OK" });
  } catch (err: any) {
    console.error("Deadline check cron error:", err);
    return NextResponse.json({ message: "Internal server error", error: err.message }, { status: 500 });
  }
}
