import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { getClientIp, checkRateLimit, checkSessionRateLimit } from "@/server/with-rate-limit";
import { verifyDelivery } from "@/server/verification";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "dispute-action", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sessionRl = checkSessionRateLimit(user.id, "dispute-action-session", 10, 60000);
  if (sessionRl) return sessionRl;

  const { id, actionId } = await params;
  const serviceId = Number(id);
  const completionId = Number(actionId);

  const service = await storage.getService(serviceId);
  if (!service) {
    return NextResponse.json({ message: "Service not found" }, { status: 404 });
  }

  if (service.creatorId !== user.id) {
    return NextResponse.json({ message: "Only the listing creator can dispute actions" }, { status: 403 });
  }

  const completion = await storage.getActionCompletion(completionId);
  if (!completion || completion.serviceId !== serviceId) {
    return NextResponse.json({ message: "Action completion not found" }, { status: 404 });
  }

  if (completion.status !== "completed") {
    return NextResponse.json({ message: `Action already ${completion.status}` }, { status: 400 });
  }

  const completerProfile = await storage.getProfile(completion.userId);
  const completerHandle = completerProfile?.twitterHandle;
  if (!completerHandle) {
    return NextResponse.json({
      message: "Completer has no Twitter handle on file — manual review required",
      verification: { status: "manual_only", message: "No Twitter handle" },
    }, { status: 200 });
  }

  const body = await request.json().catch(() => ({}));
  const { tweetUrl, targetHandle } = body as { tweetUrl?: string; targetHandle?: string };

  const result = await verifyDelivery(service.category, completerHandle, { tweetUrl, targetHandle });

  if (result.status === "verified") {
    const updated = await storage.updateActionCompletionStatus(completionId, "verified");

    const feeVaultStr = process.env.NEXT_PUBLIC_FEE_VAULT;
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

    if (feeVaultStr && rpcUrl && service.budgetCap && service.maxActions) {
      try {
        const fresh = await storage.getActionCompletion(completionId);
        if (fresh?.paidAt !== null) {
          const final = await storage.getActionCompletion(completionId);
          return NextResponse.json({ completion: final ?? updated, verification: result });
        }

        const budgetLamports = Math.round(parseFloat(service.budgetCap) * 1_000_000_000);
        const payoutPerAction = Math.floor(budgetLamports / service.maxActions);

        if (payoutPerAction > 0) {
          const orders = await storage.getOrdersBySeller(service.creatorId);
          const serviceOrders = orders.filter(o => o.serviceId === serviceId && o.escrowId);
          let escrow = null;
          for (const o of serviceOrders) {
            const e = await storage.getEscrow(o.escrowId!);
            if (e && (e.phase === "funded" || e.phase === "in_progress")) {
              escrow = e;
              break;
            }
          }

          if (escrow) {
            const connection = new Connection(rpcUrl, "confirmed");
            const deployWallet = getDeployWalletKeypair();
            const feeVault = new PublicKey(feeVaultStr);
            const depositorPubkey = new PublicKey(escrow.depositorId);
            const completerPubkey = new PublicKey(completion.userId);

            const client = new WolandEscrowClient(connection, deployWallet.publicKey);
            const ix = await client.buildReleaseActionPayoutIx(
              depositorPubkey,
              escrow.id,
              completerPubkey,
              feeVault,
              payoutPerAction,
            );

            const tx = await client.buildTransaction([ix]);
            tx.sign(deployWallet);

            const sig = await connection.sendRawTransaction(tx.serialize());
            await connection.confirmTransaction(sig, "confirmed");

            const payoutSol = (payoutPerAction / 1_000_000_000).toFixed(9);
            await storage.markActionPaid(completionId, sig, payoutSol);
          }
        }
      } catch (payErr) {
        console.error("Auto-pay failed (verification still succeeded):", payErr);
      }
    }

    const final = await storage.getActionCompletion(completionId);
    return NextResponse.json({ completion: final ?? updated, verification: result });
  }

  if (result.status === "not_found") {
    const updated = await storage.updateActionCompletionStatus(completionId, "rejected");
    return NextResponse.json({ completion: updated, verification: result });
  }

  return NextResponse.json({ completion, verification: result });
}
