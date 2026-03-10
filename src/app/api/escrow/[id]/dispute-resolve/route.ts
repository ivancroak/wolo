import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getSessionUser } from "@/server/auth";
import { storage } from "@/server/storage";
import { verifyContract } from "@/server/verification";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";
import { checkSessionRateLimit } from "@/server/with-rate-limit";
import type { EscrowPhase } from "@shared/schema";

function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL not set");
  return new Connection(rpcUrl, "confirmed");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rl = checkSessionRateLimit(user.id, "dispute-resolve", 5, 60000);
  if (rl) return rl;

  const { id } = await params;
  const escrowId = parseInt(id, 10);
  if (isNaN(escrowId)) {
    return NextResponse.json({ message: "Invalid escrow ID" }, { status: 400 });
  }

  try {
    const escrow = await storage.getEscrow(escrowId);
    if (!escrow) {
      return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
    }

    if (escrow.phase !== "disputed") {
      return NextResponse.json(
        { message: "Escrow is not in disputed phase" },
        { status: 400 },
      );
    }

    if (user.id !== escrow.receiverId && user.id !== escrow.depositorId) {
      return NextResponse.json(
        { message: "Only the depositor or receiver can submit dispute evidence" },
        { status: 403 },
      );
    }

    const order = await storage.getOrder(escrow.orderId);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const service = await storage.getService(order.serviceId);
    if (!service) {
      return NextResponse.json({ message: "Service not found" }, { status: 404 });
    }

    // AP2-M3 + AP3-H1: prevent immediate oracle — fail-closed when disputeOpenedAt is null
    if (!escrow.disputeOpenedAt) {
      return NextResponse.json(
        { message: "Dispute timestamp unavailable. Please contact support." },
        { status: 400 },
      );
    }
    const disputedAt = new Date(escrow.disputeOpenedAt).getTime();
    const deadlineMs = (service.deadlineDays ?? 3) * 24 * 60 * 60 * 1000;
    if (Date.now() < disputedAt + deadlineMs) {
      return NextResponse.json(
        { message: "Oracle resolution unavailable until seller delivery deadline has passed." },
        { status: 400 },
      );
    }

    const profile = await storage.getProfile(escrow.receiverId);
    if (!profile?.twitterHandle) {
      return NextResponse.json(
        { message: "Seller does not have an X handle on their profile" },
        { status: 400 },
      );
    }

    // AP2-H3: require verified X handle before running oracle
    if (!profile.twitterVerified) {
      return NextResponse.json(
        { message: "Seller's X handle has not been verified. Cannot run oracle." },
        { status: 400 },
      );
    }

    const effectiveKeyword = order.negotiatedRequiredKeyword ?? order.requiredKeyword;
    const effectiveService = {
      ...service,
      minPostCount: order.negotiatedMinPostCount ?? service.minPostCount,
      postsPerPeriod: order.negotiatedPostsPerPeriod ?? service.postsPerPeriod,
      threadsPerPeriod: order.negotiatedThreadsPerPeriod ?? service.threadsPerPeriod,
    };

    const result = await verifyContract(effectiveService, profile.twitterHandle, order.createdAt, effectiveKeyword);

    if (result.status === "verified" || result.status === "not_found" || result.status === "insufficient") {
      const feeVaultStr = process.env.NEXT_PUBLIC_FEE_VAULT;
      if (!feeVaultStr) {
        return NextResponse.json(
          { message: "FEE_VAULT env not set" },
          { status: 500 },
        );
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

      let depositorShareBps: number;
      let newPhase: EscrowPhase;

      if (result.status === "verified") {
        depositorShareBps = 0;
        newPhase = "released";
      } else if (result.status === "insufficient" && result.requiredPosts > 0 && result.matchingPosts > 0) {
        const sellerShareBps = Math.round((result.matchingPosts / result.requiredPosts) * 10000);
        depositorShareBps = 10000 - sellerShareBps;
        newPhase = "released";
      } else {
        depositorShareBps = 10000;
        newPhase = "refunded";
      }

      const client = new WolandEscrowClient(connection, deployWallet.publicKey);
      const ix = await client.buildArbiterResolveIx(
        depositorPubkey,
        escrowId,
        receiverPubkey,
        feeVault,
        depositorShareBps,
      );

      const { tx } = await client.buildTransaction([ix]);
      tx.sign(deployWallet);

      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      await storage.updateEscrowPhase(escrowId, newPhase, sig);

      return NextResponse.json({
        status: result.status,
        message: result.message,
        resolution: newPhase,
        signature: sig,
        matchingPosts: result.matchingPosts,
        requiredPosts: result.requiredPosts,
      });
    }

    return NextResponse.json({
      status: result.status,
      message: result.message,
      resolution: "pending",
      matchingPosts: result.matchingPosts,
      requiredPosts: result.requiredPosts,
    });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
