import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";
import { notify } from "@/server/notifications";
import { checkSessionRateLimit } from "@/server/with-rate-limit";
import { z } from "zod";

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

const resolveSchema = z.object({
  action: z.enum(["release", "skip"]),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rl = checkSessionRateLimit(user.id, "period-resolve", 10, 60000);
  if (rl) return rl;

  const { id, periodId } = await params;
  const escrowId = parseInt(id, 10);
  const pId = parseInt(periodId, 10);
  if (isNaN(escrowId) || isNaN(pId)) {
    return NextResponse.json({ message: "Invalid IDs" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const input = resolveSchema.parse(body);

    const escrow = await storage.getEscrow(escrowId);
    if (!escrow) {
      return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
    }

    const ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS;
    if (!ADMIN_WALLET || user.id !== ADMIN_WALLET) {
      return NextResponse.json({ message: "Only platform admin can resolve period disputes" }, { status: 403 });
    }

    const period = await storage.getPayrollPeriod(pId);
    if (!period || period.escrowId !== escrowId) {
      return NextResponse.json({ message: "Period not found" }, { status: 404 });
    }

    if (period.status !== "disputed") {
      return NextResponse.json({ message: "Period is not in disputed status" }, { status: 400 });
    }

    if (input.action === "release") {
      const feeVaultStr = process.env.NEXT_PUBLIC_FEE_VAULT;
      if (!feeVaultStr) {
        return NextResponse.json({ message: "FEE_VAULT env not set" }, { status: 500 });
      }

      const connection = getConnection();
      const deployWallet = getDeployWalletKeypair();
      const feeVault = new PublicKey(feeVaultStr);
      const depositorProfile = await storage.getProfile(escrow.depositorId);
      const receiverProfile = await storage.getProfile(escrow.receiverId);
      if (!depositorProfile?.walletAddress || !receiverProfile?.walletAddress) {
        return NextResponse.json({ message: "Depositor or receiver has no wallet address configured" }, { status: 400 });
      }
      const depositorPubkey = new PublicKey(depositorProfile.walletAddress);
      const receiverPubkey = new PublicKey(receiverProfile.walletAddress);
      const amountLamports = solToLamports(period.amount);

      const client = new WolandEscrowClient(connection, deployWallet.publicKey);
      const ix = await client.buildReleaseActionPayoutIx(
        depositorPubkey,
        escrow.id,
        receiverPubkey,
        feeVault,
        amountLamports,
      );

      const tx = await client.buildTransaction([ix]);
      tx.sign(deployWallet);

      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      const updated = await storage.updatePayrollPeriodStatus(pId, "paid", {
        payoutTxHash: sig,
        resolutionNote: input.note,
      });

      const newPaidCount = escrow.periodsPaid + 1;
      await storage.updateEscrowPeriodsPaid(escrow.id, newPaidCount);

      if (escrow.totalPeriods && newPaidCount >= escrow.totalPeriods) {
        await storage.updateEscrowPhase(escrow.id, "released", sig);
      }

      const link = `/orders/${escrow.orderId}`;
      await notify(escrow.receiverId, "payroll_period_paid", "Disputed Period Released", `Period ${period.periodNumber} dispute resolved: payment released.`, link);
      await notify(escrow.depositorId, "payroll_period_paid", "Disputed Period Released", `Period ${period.periodNumber} dispute resolved: payment released to seller.`, link);

      return NextResponse.json(updated);
    } else {
      // Skip — SOL stays in escrow
      const updated = await storage.updatePayrollPeriodStatus(pId, "skipped", {
        resolutionNote: input.note,
      });

      const link = `/orders/${escrow.orderId}`;
      await notify(escrow.receiverId, "payroll_period_disputed", "Period Skipped", `Period ${period.periodNumber} dispute resolved: payment skipped.`, link);
      await notify(escrow.depositorId, "payroll_period_disputed", "Period Skipped", `Period ${period.periodNumber} dispute resolved: payment skipped. SOL stays in escrow.`, link);

      return NextResponse.json(updated);
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
