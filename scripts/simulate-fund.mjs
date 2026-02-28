/**
 * Simulates the escrow funding transaction to see exact program error logs.
 * Run with: node scripts/simulate-fund.mjs
 */
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
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
const DEPOSITOR = new PublicKey("D53SxPgTG969kbr3NFkAMnwScC7NnKWXoxacnKr9Z9wk");

// We need the actual receiver from the DB. Let's try to get it from Supabase.
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

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
  // Fetch escrow data from Supabase to get the receiver
  let receiverAddress = null;
  let escrowId = null;

  if (SUPABASE_URL && SUPABASE_KEY) {
    console.log("Fetching escrow data from Supabase...");
    const url = `${SUPABASE_URL}/rest/v1/escrows?depositor_id=eq.${DEPOSITOR.toBase58()}&phase=eq.awaiting_deposit&select=id,receiver_id,amount,order_id&limit=5`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await res.json();
    console.log("Escrows awaiting deposit:", JSON.stringify(data, null, 2));

    if (data.length > 0) {
      escrowId = data[0].id;
      receiverAddress = data[0].receiver_id;
      console.log(`\nUsing escrow #${escrowId}, receiver: ${receiverAddress}`);
    }
  }

  if (!receiverAddress || !escrowId) {
    console.log("Could not find escrow from DB. Using escrow #5 with depositor as placeholder receiver.");
    escrowId = 5;
    receiverAddress = DEPOSITOR.toBase58(); // placeholder
  }

  const receiver = new PublicKey(receiverAddress);
  const [configPDA] = findConfigPDA();
  const [escrowPDA] = findEscrowPDA(DEPOSITOR, escrowId);
  const amountLamports = 500_000_000; // 0.5 SOL
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 86400;

  console.log("\n=== Transaction Details ===");
  console.log("Escrow ID:", escrowId);
  console.log("Depositor:", DEPOSITOR.toBase58());
  console.log("Receiver:", receiver.toBase58());
  console.log("Escrow PDA:", escrowPDA.toBase58());
  console.log("Config PDA:", configPDA.toBase58());
  console.log("Amount:", amountLamports, "lamports");
  console.log("Expires at:", expiresAt);

  const disc = await getDiscriminator("initialize_escrow");
  console.log("\nDiscriminator (hex):", disc.toString("hex"));

  const ixData = Buffer.concat([
    disc,
    encodeU64(escrowId),
    encodeU64(amountLamports),
    encodeI64(expiresAt),
  ]);
  console.log("Instruction data (hex):", ixData.toString("hex"));
  console.log("Instruction data length:", ixData.length, "bytes");

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: DEPOSITOR, isSigner: true, isWritable: true },
      { pubkey: receiver, isSigner: false, isWritable: false },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: ixData,
  });

  // Build and simulate
  const { blockhash } = await connection.getLatestBlockhash();

  const messageV0 = new TransactionMessage({
    payerKey: DEPOSITOR,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const vtx = new VersionedTransaction(messageV0);

  console.log("\n=== Simulating... ===");
  try {
    const result = await connection.simulateTransaction(vtx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    console.log("\nSimulation result:");
    console.log("  Error:", JSON.stringify(result.value.err));
    console.log("  Logs:");
    (result.value.logs || []).forEach(log => console.log("   ", log));
    console.log("  Units consumed:", result.value.unitsConsumed);
  } catch (err) {
    console.error("Simulation failed:", err.message);
    if (err.logs) {
      console.log("Logs:");
      err.logs.forEach(log => console.log("   ", log));
    }
  }
}

main().catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});
