import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { storage } from "@/server/storage";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import { WolandReputationClient } from "@/lib/solana/reputation-client";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";
import { notify } from "@/server/notifications";

function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL not set");
  return new Connection(rpcUrl, "confirmed");
}

function solToLamports(sol: string): number {
  const parts = sol.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").padEnd(9, "0").slice(0, 9);
  return Number(BigInt(whole) * BigInt(1_000_000_000) + BigInt(frac));
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const results = { activated: 0, released: 0, errors: [] as string[] };

  try {
    // Phase 1: Activate pending periods whose start time has arrived
    const activatable = await storage.getActivatablePayrollPeriods();
    for (const period of activatable) {
      try {
        await storage.updatePayrollPeriodStatus(period.id, "active");
        results.activated++;
      } catch (err: any) {
        results.errors.push(`activate period ${period.id}: ${err.message}`);
      }
    }

    // Phase 2: Release periods past dispute deadline
    const releasable = await storage.getReleasablePayrollPeriods();
    if (releasable.length === 0) {
      return NextResponse.json({ ...results, message: "OK" });
    }

    const feeVaultStr = process.env.NEXT_PUBLIC_FEE_VAULT;
    if (!feeVaultStr) {
      return NextResponse.json({ message: "FEE_VAULT env not set" }, { status: 500 });
    }

    const connection = getConnection();
    const deployWallet = getDeployWalletKeypair();
    const feeVault = new PublicKey(feeVaultStr);
    const client = new WolandEscrowClient(connection, deployWallet.publicKey);

    for (const period of releasable) {
      try {
        const escrow = await storage.getEscrow(period.escrowId);
        if (!escrow) {
          results.errors.push(`period ${period.id}: escrow ${period.escrowId} not found`);
          continue;
        }

        // Only release from funded or in_progress escrows
        if (escrow.phase !== "funded" && escrow.phase !== "in_progress") {
          results.errors.push(`period ${period.id}: escrow phase is ${escrow.phase}, skipping`);
          continue;
        }

        const depositorProfile = await storage.getProfile(escrow.depositorId);
        const receiverProfile = await storage.getProfile(escrow.receiverId);
        if (!depositorProfile?.walletAddress || !receiverProfile?.walletAddress) {
          results.errors.push(`period ${period.id}: depositor or receiver has no wallet address`);
          continue;
        }
        const depositorPubkey = new PublicKey(depositorProfile.walletAddress);
        const receiverPubkey = new PublicKey(receiverProfile.walletAddress);
        const amountLamports = solToLamports(period.amount);

        const ix = await client.buildReleaseActionPayoutIx(
          depositorPubkey,
          escrow.id,
          receiverPubkey,
          feeVault,
          amountLamports,
        );

        const { tx } = await client.buildTransaction([ix]);
        tx.sign(deployWallet);

        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, "confirmed");

        await storage.updatePayrollPeriodStatus(period.id, "paid", { payoutTxHash: sig });

        // Record on-chain reputation for the receiver (seller completed the period)
        try {
          const repClient = new WolandReputationClient(connection, deployWallet.publicKey);
          const repPDA = repClient.getReputationPDA(receiverPubkey);
          const repInfo = await connection.getAccountInfo(repPDA);

          const ixs = [];
          if (!repInfo) {
            // Seller has no reputation account yet — initialize it first
            // Note: buildInitializeReputationIx uses walletPubkey (deploy wallet) as payer,
            // but the PDA is derived from walletPubkey. We need a custom init for receiverPubkey.
            // Since the on-chain program requires the user themselves to init their rep account,
            // skip reputation recording for users without an existing account.
            console.warn(`Reputation PDA not initialized for receiver ${receiverPubkey.toBase58()}, skipping reputation recording for period ${period.id}`);
          } else {
            const repIx = await repClient.buildRecordCompletionIx(
              receiverPubkey,
              escrow.id,
              amountLamports,
              false, // receiver is the seller, not the buyer
            );
            ixs.push(repIx);

            const repTx = await repClient.buildTransaction(ixs);
            repTx.sign(deployWallet);
            const repSig = await connection.sendRawTransaction(repTx.serialize());
            await connection.confirmTransaction(repSig, "confirmed");
          }
        } catch (repErr: any) {
          // Don't fail the period release if reputation recording fails
          console.warn(`Reputation recording failed for period ${period.id}:`, repErr?.message);
        }

        const newPaidCount = escrow.periodsPaid + 1;
        await storage.updateEscrowPeriodsPaid(escrow.id, newPaidCount);

        // If all periods paid, transition escrow to released
        if (escrow.totalPeriods && newPaidCount >= escrow.totalPeriods) {
          await storage.updateEscrowPhase(escrow.id, "released", sig);
        }

        // Notify both parties
        const link = `/orders/${escrow.orderId}`;
        await notify(
          escrow.receiverId,
          "payroll_period_paid",
          "Period Payment Released",
          `Period ${period.periodNumber} of ${escrow.totalPeriods}: ${period.amount} SOL released to you.`,
          link,
        );
        await notify(
          escrow.depositorId,
          "payroll_period_paid",
          "Period Payment Released",
          `Period ${period.periodNumber} of ${escrow.totalPeriods}: ${period.amount} SOL released to seller.`,
          link,
        );

        results.released++;
      } catch (err: any) {
        results.errors.push(`release period ${period.id}: ${err.message}`);
      }
    }

    return NextResponse.json({ ...results, message: "OK" });
  } catch (err: any) {
    console.error("Payroll cron error:", err);
    return NextResponse.json({ message: "Internal server error", error: err.message }, { status: 500 });
  }
}
