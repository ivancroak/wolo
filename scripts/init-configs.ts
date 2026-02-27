/**
 * Initialize PlatformConfig (escrow) and ReputationConfig (reputation) on devnet.
 *
 * Usage:
 *   npx ts-node --esm scripts/init-configs.ts
 *
 * Requires:
 *   - ~/.config/solana/id.json  (the deploy authority keypair)
 *   - target/idl/woland_escrow.json & woland_reputation.json
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ESCROW_PROGRAM_ID = new PublicKey("4gVLZxZQuqKKw7JxDPdMUuZ6p33Ednh65mqJWwEsgGzM");
const REPUTATION_PROGRAM_ID = new PublicKey("CjNEAXDzVY5aTsHQaHuLMioVkUucu4aEwFZMTWWwXxvR");

// Platform fee: 250 bps = 2.5%
const FEE_BPS = 500;

async function main() {
  // Load wallet from default Solana CLI keypair
  const keypairPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secret));

  console.log("Authority wallet:", wallet.publicKey.toBase58());

  // Connect to devnet
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Load IDLs
  const escrowIdl = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../target/idl/woland_escrow.json"),
      "utf-8"
    )
  );
  const reputationIdl = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../target/idl/woland_reputation.json"),
      "utf-8"
    )
  );

  const escrowProgram = new Program(escrowIdl, provider);
  const reputationProgram = new Program(reputationIdl, provider);

  // --- 1. Initialize Escrow PlatformConfig ---
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    ESCROW_PROGRAM_ID
  );

  console.log("\n--- Escrow: initialize_config ---");
  console.log("Config PDA:", configPda.toBase58());
  console.log("Fee:", FEE_BPS, "bps (" + FEE_BPS / 100 + "%)");
  console.log("Fee vault:", wallet.publicKey.toBase58(), "(authority wallet)");

  try {
    const info = await connection.getAccountInfo(configPda);
    if (info) {
      console.log("Config PDA already exists — skipping.");
    } else {
      const tx = await (escrowProgram.methods as any)
        .initializeConfig(FEE_BPS)
        .accounts({
          authority: wallet.publicKey,
          config: configPda,
          feeVault: wallet.publicKey, // fees go to authority wallet
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();
      console.log("Escrow config initialized. Tx:", tx);
    }
  } catch (err: any) {
    console.error("Escrow init failed:", err.message || err);
  }

  // --- 2. Initialize Reputation RepConfig ---
  const [repConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("rep_config")],
    REPUTATION_PROGRAM_ID
  );

  console.log("\n--- Reputation: initialize_rep_config ---");
  console.log("RepConfig PDA:", repConfigPda.toBase58());

  try {
    const info = await connection.getAccountInfo(repConfigPda);
    if (info) {
      console.log("RepConfig PDA already exists — skipping.");
    } else {
      const tx = await (reputationProgram.methods as any)
        .initializeRepConfig()
        .accounts({
          authority: wallet.publicKey,
          config: repConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();
      console.log("Reputation config initialized. Tx:", tx);
    }
  } catch (err: any) {
    console.error("Reputation init failed:", err.message || err);
  }

  console.log("\nDone!");
}

main().catch(console.error);
