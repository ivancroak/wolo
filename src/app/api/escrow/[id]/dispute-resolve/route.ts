import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getSessionUser } from "@/server/auth";
import { storage } from "@/server/storage";
import { verifyDelivery } from "@/server/verification";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";
import { z } from "zod";
import type { ServiceCategory } from "@shared/schema";

const inputSchema = z.object({
  tweetUrl: z.string().optional(),
  targetHandle: z.string().optional(),
});

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
    const body = await request.json();
    const input = inputSchema.parse(body);

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

    if (user.id !== escrow.receiverId) {
      return NextResponse.json(
        { message: "Only the receiver (seller) can submit dispute evidence" },
        { status: 403 },
      );
    }

    // Look up the order → service to get the category
    const order = await storage.getOrder(escrow.orderId);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const service = await storage.getService(order.serviceId);
    if (!service) {
      return NextResponse.json({ message: "Service not found" }, { status: 404 });
    }

    // Look up seller's X handle from their profile
    const profile = await storage.getProfile(escrow.receiverId);
    if (!profile?.twitterHandle) {
      return NextResponse.json(
        { message: "Seller does not have a verified Twitter/X handle on their profile" },
        { status: 400 },
      );
    }

    const category = service.category as ServiceCategory;
    const result = await verifyDelivery(category, profile.twitterHandle, {
      tweetUrl: input.tweetUrl,
      targetHandle: input.targetHandle,
    });

    // Auto-resolve only for verified / not_found
    if (result.status === "verified" || result.status === "not_found") {
      const mintStr = process.env.NEXT_PUBLIC_SPL_TOKEN_MINT;
      const feeVaultStr = process.env.NEXT_PUBLIC_FEE_VAULT;
      if (!mintStr || !feeVaultStr) {
        return NextResponse.json(
          { message: "SPL_TOKEN_MINT or FEE_VAULT env not set" },
          { status: 500 },
        );
      }

      const connection = getConnection();
      const deployWallet = getDeployWalletKeypair();
      const mint = new PublicKey(mintStr);
      const feeVault = new PublicKey(feeVaultStr);
      const depositorPubkey = new PublicKey(escrow.depositorId);
      const receiverPubkey = new PublicKey(escrow.receiverId);

      // verified → 100% to seller (depositorShareBps=0)
      // not_found → 100% to buyer (depositorShareBps=10000)
      const depositorShareBps = result.status === "verified" ? 0 : 10000;
      const newPhase = result.status === "verified" ? "released" : "refunded";

      const client = new WolandEscrowClient(connection, deployWallet.publicKey);
      const ix = await client.buildArbiterResolveIx(
        depositorPubkey,
        escrowId,
        receiverPubkey,
        mint,
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
        details: result.details,
      });
    }

    // manual_only or error → no on-chain action, stays disputed
    return NextResponse.json({
      status: result.status,
      message: result.message,
      resolution: "pending",
      details: result.details,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: err.errors[0].message, field: err.errors[0].path.join(".") },
        { status: 400 },
      );
    }
    throw err;
  }
}
