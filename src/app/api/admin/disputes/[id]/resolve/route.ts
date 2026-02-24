import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getSessionUser } from "@/server/auth";
import { storage } from "@/server/storage";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";
import { z } from "zod";

const ADMIN_WALLET = "2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL";

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

    const updated = await storage.updateEscrowPhase(escrowId, "released", sig);

    return NextResponse.json({ ...updated, depositorShareBps, signature: sig });
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
