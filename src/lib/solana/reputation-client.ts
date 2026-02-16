import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import { REPUTATION_PROGRAM_ID } from "./idl";
import { encodeU64 } from "./escrow-client";

const programId = new PublicKey(REPUTATION_PROGRAM_ID);

function findReputationPDA(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reputation"), user.toBuffer()],
    programId
  );
}

function findRatingPDA(rater: PublicKey, escrowId: number): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(escrowId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rating"), rater.toBuffer(), idBuf],
    programId
  );
}

async function getDiscriminator(name: string): Promise<Buffer> {
  const data = new TextEncoder().encode(`global:${name}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
}

async function hashComment(comment: string): Promise<Buffer> {
  const data = new TextEncoder().encode(comment);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 32));
}

export class WolandReputationClient {
  constructor(
    private connection: Connection,
    private walletPubkey: PublicKey,
  ) {}

  async buildInitializeReputationIx(): Promise<TransactionInstruction> {
    const [repPDA] = findReputationPDA(this.walletPubkey);
    const disc = await getDiscriminator("initialize_reputation");

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: true },
        { pubkey: repPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId,
      data: disc,
    });
  }

  async buildRecordCompletionIx(
    userPubkey: PublicKey,
    escrowId: number,
    amount: number,
    isBuyer: boolean,
  ): Promise<TransactionInstruction> {
    const [repPDA] = findReputationPDA(userPubkey);
    const disc = await getDiscriminator("record_completion");

    const data = Buffer.concat([
      disc,
      encodeU64(escrowId),
      encodeU64(amount),
      Buffer.from([isBuyer ? 1 : 0]),
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: false },
        { pubkey: repPDA, isSigner: false, isWritable: true },
      ],
      programId,
      data,
    });
  }

  async buildRecordDisputeIx(
    userPubkey: PublicKey,
    escrowId: number,
  ): Promise<TransactionInstruction> {
    const [repPDA] = findReputationPDA(userPubkey);
    const disc = await getDiscriminator("record_dispute");

    const data = Buffer.concat([disc, encodeU64(escrowId)]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: false },
        { pubkey: repPDA, isSigner: false, isWritable: true },
      ],
      programId,
      data,
    });
  }

  async buildSubmitRatingIx(
    targetPubkey: PublicKey,
    escrowId: number,
    score: number,
    comment: string,
  ): Promise<TransactionInstruction> {
    const [targetRepPDA] = findReputationPDA(targetPubkey);
    const [ratingPDA] = findRatingPDA(this.walletPubkey, escrowId);
    const disc = await getDiscriminator("submit_rating");
    const commentHashBuf = await hashComment(comment || "");

    const data = Buffer.concat([
      disc,
      encodeU64(escrowId),
      Buffer.from([score]),
      commentHashBuf,
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: true },
        { pubkey: targetRepPDA, isSigner: false, isWritable: true },
        { pubkey: ratingPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId,
      data,
    });
  }

  async buildTransaction(instructions: TransactionInstruction[]): Promise<Transaction> {
    const tx = new Transaction();
    instructions.forEach(ix => tx.add(ix));
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = this.walletPubkey;
    return tx;
  }

  getReputationPDA(user?: PublicKey): PublicKey {
    const [pda] = findReputationPDA(user ?? this.walletPubkey);
    return pda;
  }

  getRatingPDA(escrowId: number): PublicKey {
    const [pda] = findRatingPDA(this.walletPubkey, escrowId);
    return pda;
  }
}
