/**
 * Debug script: simulates the escrow funding transaction to see the exact error.
 * Run with: node scripts/debug-escrow.mjs
 */
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const RPC_URL = env.NEXT_PUBLIC_SOLANA_RPC_URL;
const PROGRAM_ID = env.NEXT_PUBLIC_ESCROW_PROGRAM_ID;

const connection = new Connection(RPC_URL, "confirmed");
const programId = new PublicKey(PROGRAM_ID);

// The depositor wallet address from the user
const DEPOSITOR = new PublicKey("D53SxPgTG969kbr3NFkAMnwScC7NnKWXoxacnKr9Z9wk");

function findConfigPDA() {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
}

function findEscrowPDA(depositor, escrowId) {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(escrowId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), depositor.toBuffer(), idBuf],
    programId
  );
}

function encodeU64(val) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(val));
  return buf;
}

function encodeI64(val) {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(val));
  return buf;
}

async function getDiscriminator(name) {
  const data = new TextEncoder().encode(`global:${name}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
}

async function main() {
  console.log("=== ESCROW FUNDING DEBUG ===\n");
  console.log("Program ID:", programId.toBase58());
  console.log("Depositor:", DEPOSITOR.toBase58());

  // Check config PDA
  const [configPDA] = findConfigPDA();
  console.log("\nConfig PDA:", configPDA.toBase58());
  const configInfo = await connection.getAccountInfo(configPDA);
  if (configInfo) {
    console.log("  Status: INITIALIZED");
    console.log("  Owner:", configInfo.owner.toBase58());
    console.log("  Data length:", configInfo.data.length, "bytes");
    console.log("  Data (hex):", configInfo.data.toString("hex"));
  } else {
    console.log("  Status: NOT INITIALIZED -- this is the problem!");
    return;
  }

  // Check depositor balance
  const balance = await connection.getBalance(DEPOSITOR);
  console.log("\nDepositor balance:", balance / 1e9, "SOL");

  // Check escrow PDAs for escrow IDs 1-10
  console.log("\n--- Checking escrow PDAs ---");
  for (let escrowId = 1; escrowId <= 10; escrowId++) {
    const [escrowPDA] = findEscrowPDA(DEPOSITOR, escrowId);
    const info = await connection.getAccountInfo(escrowPDA);
    if (info) {
      console.log(`  Escrow #${escrowId}: EXISTS at ${escrowPDA.toBase58()} (owner: ${info.owner.toBase58()}, ${info.data.length} bytes)`);
    } else {
      console.log(`  Escrow #${escrowId}: not found (PDA: ${escrowPDA.toBase58()})`);
    }
  }

  // Now simulate the actual transaction for escrow #5
  const ESCROW_ID = 5;
  const RECEIVER = new PublicKey("D53SxPgTG969kbr3NFkAMnwScC7NnKWXoxacnKr9Z9wk"); // placeholder, we'll get from DB
  const AMOUNT_LAMPORTS = 500_000_000; // 0.5 SOL
  const EXPIRES_AT = Math.floor(Date.now() / 1000) + 30 * 86400;

  console.log("\n--- Simulating escrow #5 funding ---");
  console.log("  Amount:", AMOUNT_LAMPORTS, "lamports (0.5 SOL)");
  console.log("  Expires at:", new Date(EXPIRES_AT * 1000).toISOString());

  // We can't actually simulate without the depositor's signature,
  // but we can check if the escrow PDA already exists
  const [escrowPDA5] = findEscrowPDA(DEPOSITOR, ESCROW_ID);
  const escrow5Info = await connection.getAccountInfo(escrowPDA5);
  if (escrow5Info) {
    console.log("\n  *** ESCROW #5 PDA ALREADY EXISTS! ***");
    console.log("  This is likely from a previous attempt that created the account");
    console.log("  but the confirmation/UI didn't register it.");
    console.log("  Owner:", escrow5Info.owner.toBase58());
    console.log("  Data length:", escrow5Info.data.length, "bytes");
    console.log("  Data (hex):", escrow5Info.data.toString("hex").slice(0, 100), "...");

    // Try to decode phase byte
    if (escrow5Info.data.length > 96) {
      const phaseByte = escrow5Info.data[96];
      const phases = ["awaiting_deposit", "funded", "in_progress", "under_review", "milestone_check", "released", "refunded", "disputed"];
      console.log("  Phase byte:", phaseByte, "=", phases[phaseByte] || "unknown");
    }
  } else {
    console.log("  Escrow #5 PDA: not found (this is expected for new escrows)");
  }

  // Check if the configPDA is owned by the right program
  if (configInfo.owner.toBase58() !== programId.toBase58()) {
    console.log("\n  *** CONFIG PDA OWNER MISMATCH ***");
    console.log("  Expected:", programId.toBase58());
    console.log("  Actual:", configInfo.owner.toBase58());
    console.log("  This means the config was initialized by a different program!");
  }

  // Check the escrow DB entry
  console.log("\n--- Checking Supabase escrow data ---");
  console.log("  (Run this in Supabase SQL Editor to get receiver_id):");
  console.log("  SELECT id, order_id, depositor_id, receiver_id, amount, phase FROM escrows WHERE depositor_id = 'D53SxPgTG969kbr3NFkAMnwScC7NnKWXoxacnKr9Z9wk';");
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
