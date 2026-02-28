/**
 * One-time script to initialize the escrow program config PDA on devnet.
 * Run with: node scripts/init-config.mjs
 */
import { Connection, PublicKey, SystemProgram, Transaction, Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Read .env manually (no dotenv dependency)
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
const FEE_VAULT = env.NEXT_PUBLIC_FEE_VAULT;
const DEPLOY_KEY = env.SOLANA_DEPLOY_WALLET_PRIVATE_KEY;

if (!RPC_URL || !PROGRAM_ID || !FEE_VAULT || !DEPLOY_KEY) {
  console.error("Missing env vars. Make sure .env has:");
  console.error("  NEXT_PUBLIC_SOLANA_RPC_URL");
  console.error("  NEXT_PUBLIC_ESCROW_PROGRAM_ID");
  console.error("  NEXT_PUBLIC_FEE_VAULT");
  console.error("  SOLANA_DEPLOY_WALLET_PRIVATE_KEY");
  process.exit(1);
}

// Base58 decode
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(str) {
  const map = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]] = i;
  const bytes = [0];
  for (const char of str) {
    let carry = map[char];
    if (carry === undefined) throw new Error("Invalid base58 char: " + char);
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char === "1") bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

async function getDiscriminator(name) {
  const data = new TextEncoder().encode(`global:${name}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);
  const feeVault = new PublicKey(FEE_VAULT);
  const authority = Keypair.fromSecretKey(base58Decode(DEPLOY_KEY));

  console.log("Program ID:", programId.toBase58());
  console.log("Fee Vault:", feeVault.toBase58());
  console.log("Authority:", authority.publicKey.toBase58());

  // Derive config PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId,
  );
  console.log("Config PDA:", configPDA.toBase58());

  // Check if already initialized
  const info = await connection.getAccountInfo(configPDA);
  if (info) {
    console.log("\nConfig PDA already initialized! Owner:", info.owner.toBase58());
    console.log("No action needed.");
    return;
  }

  console.log("\nConfig PDA not found. Initializing...");

  const FEE_BPS = 250; // 2.5%
  const disc = await getDiscriminator("initialize_config");
  const data = Buffer.alloc(10);
  disc.copy(data);
  data.writeUInt16LE(FEE_BPS, 8);

  const ix = {
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: feeVault, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  };

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = authority.publicKey;
  tx.sign(authority);

  const sig = await connection.sendRawTransaction(tx.serialize());
  console.log("Transaction sent:", sig);

  await connection.confirmTransaction(sig, "confirmed");
  console.log("Confirmed! Config PDA initialized.");
  console.log("\nYou can now fund escrows from any wallet.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
