import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
} from "@solana/web3.js";
import { ESCROW_PROGRAM_ID } from "./idl";

let _programId: PublicKey | null = null;
function getProgramId(): PublicKey {
  if (!_programId) _programId = new PublicKey(ESCROW_PROGRAM_ID);
  return _programId;
}

function findConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], getProgramId());
}

async function getDiscriminator(name: string): Promise<Buffer> {
  const data = new TextEncoder().encode(`global:${name}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
}

export async function isConfigInitialized(connection: Connection): Promise<boolean> {
  const [configPDA] = findConfigPDA();
  const info = await connection.getAccountInfo(configPDA);
  return info !== null;
}

export async function buildInitializeConfigTx(
  connection: Connection,
  authority: PublicKey,
  feeVault: PublicKey,
  feeBps: number,
): Promise<Transaction> {
  const [configPDA] = findConfigPDA();
  const disc = await getDiscriminator("initialize_config");

  const data = Buffer.alloc(10);
  disc.copy(data);
  data.writeUInt16LE(feeBps, 8);

  const ix = {
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: feeVault, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: getProgramId(),
    data,
  };

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = authority;
  return tx;
}

export function getConfigPDA(): PublicKey {
  const [pda] = findConfigPDA();
  return pda;
}
