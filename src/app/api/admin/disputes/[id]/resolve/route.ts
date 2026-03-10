import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getSessionUser } from "@/server/auth";
import { storage } from "@/server/storage";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";
import { z } from "zod";

const resolveSchema = z.object({
  depositorShareBps: z.number().int().min(0).max(10000),
});

function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL not set");
  return new Connection(rpcUrl, "confirmed");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS;
  if (!ADMIN_WALLET) {
    return NextResponse.json({ message: "ADMIN_WALLET_ADDRESS not configured" }, { status: 500 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (user.id !== ADMIN_WALLET) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const escrowId = parseInt(id, 10);
  if (isNaN(escrowId)) {
    return NextResponse.json({ message: "Invalid escrow ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { depositorShareBps } = resolveSchema.parse(body);

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

    const resolvedPhase = depositorShareBps >= 10000 ? "refunded" as const : "released" as const;
    const updated = await storage.updateEscrowPhase(escrowId, resolvedPhase, sig);

    return NextResponse.json({ ...updated, depositorShareBps, signature: sig });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: err.errors[0].message, field: err.errors[0].path.join(".") },
        { status: 400 },
      );
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
