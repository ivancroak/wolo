import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getSessionUser } from "@/server/auth";
import { storage } from "@/server/storage";
import { verifyContract } from "@/server/verification";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";
import type { EscrowPhase } from "@shared/schema";

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return false;
}

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

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { message: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  }

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

    const profile = await storage.getProfile(escrow.receiverId);
    if (!profile?.twitterHandle) {
      return NextResponse.json(
        { message: "Seller does not have a verified Twitter/X handle on their profile" },
        { status: 400 },
      );
    }

    const result = await verifyContract(service, profile.twitterHandle, order.createdAt);

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
      const depositorPubkey = new PublicKey(escrow.depositorId);
      const receiverPubkey = new PublicKey(escrow.receiverId);

      const depositorShareBps = result.status === "verified" ? 0 : 10000;
      const newPhase: EscrowPhase = result.status === "verified" ? "released" : "refunded";

      const client = new WolandEscrowClient(connection, deployWallet.publicKey);
      const ix = await client.buildArbiterResolveIx(
        depositorPubkey,
        escrowId,
        receiverPubkey,
        feeVault,
        depositorShareBps,
      );

      const tx = await client.buildTransaction([ix]);
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
