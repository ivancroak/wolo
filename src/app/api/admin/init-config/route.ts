import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getSessionUser } from "@/server/auth";
import {
  isConfigInitialized,
  buildInitializeConfigTx,
  getConfigPDA,
} from "@/lib/solana/setup";
import { getDeployWalletKeypair } from "@/lib/solana/deploy-wallet";

const ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS || "2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL";
const FEE_BPS = 250; // 2.5%

function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL not set");
  return new Connection(rpcUrl, "confirmed");
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id !== ADMIN_WALLET) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const connection = getConnection();
    const initialized = await isConfigInitialized(connection);
    const configPDA = getConfigPDA().toBase58();
    return NextResponse.json({ initialized, configPDA });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message ?? "Failed to check config" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id !== ADMIN_WALLET) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const connection = getConnection();

    const already = await isConfigInitialized(connection);
    if (already) {
      return NextResponse.json({
        message: "Config already initialized",
        configPDA: getConfigPDA().toBase58(),
      });
    }

    const feeVaultStr = process.env.NEXT_PUBLIC_FEE_VAULT;
    if (!feeVaultStr) {
      return NextResponse.json(
        { message: "NEXT_PUBLIC_FEE_VAULT not set" },
        { status: 500 },
      );
    }
    const feeVault = new PublicKey(feeVaultStr);
    const deployWallet = getDeployWalletKeypair();

    const tx = await buildInitializeConfigTx(
      connection,
      deployWallet.publicKey,
      feeVault,
      FEE_BPS,
    );
    tx.sign(deployWallet);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    return NextResponse.json({
      message: "Config initialized successfully",
      signature: sig,
      configPDA: getConfigPDA().toBase58(),
      feeBps: FEE_BPS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message ?? "Failed to initialize config" },
      { status: 500 },
    );
  }
}
