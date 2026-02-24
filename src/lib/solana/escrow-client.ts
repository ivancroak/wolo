import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { ESCROW_PROGRAM_ID } from "./idl";

const programId = new PublicKey(ESCROW_PROGRAM_ID);

function findConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
}

function findEscrowPDA(depositor: PublicKey, escrowId: number): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(escrowId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), depositor.toBuffer(), idBuf],
    programId
  );
}

function findVaultPDA(escrowPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrowPDA.toBuffer()],
    programId
  );
}

export function encodeU64(val: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(val));
  return buf;
}

export function encodeI64(val: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(val));
  return buf;
}

function encodeU16(val: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(val);
  return buf;
}

async function getDiscriminator(name: string): Promise<Buffer> {
  const data = new TextEncoder().encode(`global:${name}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
}

async function hashTitle(title: string): Promise<Buffer> {
  const data = new TextEncoder().encode(title);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 32));
}

export class WolandEscrowClient {
  constructor(
    private connection: Connection,
    private walletPubkey: PublicKey,
  ) {}

  async buildInitializeEscrowIx(
    receiverPubkey: PublicKey,
    mintPubkey: PublicKey,
    escrowId: number,
    amountLamports: number,
    expiresAt: number,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(this.walletPubkey, escrowId);
    const [vaultPDA] = findVaultPDA(escrowPDA);
    const [configPDA] = findConfigPDA();
    const disc = await getDiscriminator("initialize_escrow");

    const data = Buffer.concat([
      disc,
      encodeU64(escrowId),
      encodeU64(amountLamports),
      encodeI64(expiresAt),
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: true },
        { pubkey: receiverPubkey, isSigner: false, isWritable: false },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: configPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId,
      data,
    });
  }

  async buildFundEscrowIx(
    escrowId: number,
    mintPubkey: PublicKey,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(this.walletPubkey, escrowId);
    const [vaultPDA] = findVaultPDA(escrowPDA);
    const [configPDA] = findConfigPDA();
    const depositorATA = await getAssociatedTokenAddress(mintPubkey, this.walletPubkey);
    const disc = await getDiscriminator("fund_escrow");

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: depositorATA, isSigner: false, isWritable: true },
        { pubkey: configPDA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data: disc,
    });
  }

  async buildAddMilestoneIx(
    depositorPubkey: PublicKey,
    escrowId: number,
    title: string,
    amount: number,
    deadlineOffsetSeconds: number,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(depositorPubkey, escrowId);
    const disc = await getDiscriminator("add_milestone");
    const titleHashBuf = await hashTitle(title);

    const data = Buffer.concat([
      disc,
      titleHashBuf,
      encodeU64(amount),
      encodeI64(deadlineOffsetSeconds),
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: false },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
      ],
      programId,
      data,
    });
  }

  async buildSubmitMilestoneIx(
    depositorPubkey: PublicKey,
    escrowId: number,
    milestoneIdx: number,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(depositorPubkey, escrowId);
    const disc = await getDiscriminator("submit_milestone");
    const data = Buffer.concat([disc, Buffer.from([milestoneIdx])]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: false },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
      ],
      programId,
      data,
    });
  }

  async buildRejectMilestoneIx(
    depositorPubkey: PublicKey,
    escrowId: number,
    milestoneIdx: number,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(depositorPubkey, escrowId);
    const disc = await getDiscriminator("reject_milestone");
    const data = Buffer.concat([disc, Buffer.from([milestoneIdx])]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: false },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
      ],
      programId,
      data,
    });
  }

  async buildAdvancePhaseIx(
    depositorPubkey: PublicKey,
    escrowId: number,
    newPhase: number,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(depositorPubkey, escrowId);
    const disc = await getDiscriminator("advance_phase");
    const data = Buffer.concat([disc, Buffer.from([newPhase])]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: false },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
      ],
      programId,
      data,
    });
  }

  async buildReleaseFundsIx(
    escrowId: number,
    receiverPubkey: PublicKey,
    mintPubkey: PublicKey,
    feeVaultPubkey: PublicKey,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(this.walletPubkey, escrowId);
    const [vaultPDA] = findVaultPDA(escrowPDA);
    const [configPDA] = findConfigPDA();
    const receiverATA = await getAssociatedTokenAddress(mintPubkey, receiverPubkey);
    const disc = await getDiscriminator("release_funds");

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: receiverATA, isSigner: false, isWritable: true },
        { pubkey: feeVaultPubkey, isSigner: false, isWritable: true },
        { pubkey: configPDA, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data: disc,
    });
  }

  async buildReleaseMilestoneIx(
    escrowId: number,
    receiverPubkey: PublicKey,
    mintPubkey: PublicKey,
    feeVaultPubkey: PublicKey,
    milestoneIdx: number,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(this.walletPubkey, escrowId);
    const [vaultPDA] = findVaultPDA(escrowPDA);
    const [configPDA] = findConfigPDA();
    const receiverATA = await getAssociatedTokenAddress(mintPubkey, receiverPubkey);
    const disc = await getDiscriminator("release_milestone");
    const data = Buffer.concat([disc, Buffer.from([milestoneIdx])]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: receiverATA, isSigner: false, isWritable: true },
        { pubkey: feeVaultPubkey, isSigner: false, isWritable: true },
        { pubkey: configPDA, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data,
    });
  }

  async buildRefundIx(
    depositorPubkey: PublicKey,
    escrowId: number,
    mintPubkey: PublicKey,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(depositorPubkey, escrowId);
    const [vaultPDA] = findVaultPDA(escrowPDA);
    const depositorATA = await getAssociatedTokenAddress(mintPubkey, depositorPubkey);
    const disc = await getDiscriminator("refund");

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: depositorATA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data: disc,
    });
  }

  async buildArbiterResolveIx(
    depositorPubkey: PublicKey,
    escrowId: number,
    receiverPubkey: PublicKey,
    mintPubkey: PublicKey,
    feeVaultPubkey: PublicKey,
    depositorShareBps: number,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(depositorPubkey, escrowId);
    const [vaultPDA] = findVaultPDA(escrowPDA);
    const [configPDA] = findConfigPDA();
    const depositorATA = await getAssociatedTokenAddress(mintPubkey, depositorPubkey);
    const receiverATA = await getAssociatedTokenAddress(mintPubkey, receiverPubkey);
    const disc = await getDiscriminator("arbiter_resolve");
    const data = Buffer.concat([disc, encodeU16(depositorShareBps)]);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: false },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: depositorATA, isSigner: false, isWritable: true },
        { pubkey: receiverATA, isSigner: false, isWritable: true },
        { pubkey: feeVaultPubkey, isSigner: false, isWritable: true },
        { pubkey: configPDA, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data,
    });
  }

  async buildUpdateConfigIx(
    newArbiter: PublicKey | null,
    newFeeBps: number | null,
    newAuthority: PublicKey | null,
    newFeeVault: PublicKey | null,
  ): Promise<TransactionInstruction> {
    const [configPDA] = findConfigPDA();
    const disc = await getDiscriminator("update_config");

    const parts: Buffer[] = [disc];
    // Option<Pubkey>: 1 byte tag + 32 bytes if Some
    if (newArbiter) {
      parts.push(Buffer.from([1]), newArbiter.toBuffer());
    } else {
      parts.push(Buffer.from([0]));
    }
    // Option<u16>
    if (newFeeBps !== null) {
      const buf = Buffer.alloc(3);
      buf[0] = 1;
      buf.writeUInt16LE(newFeeBps, 1);
      parts.push(buf);
    } else {
      parts.push(Buffer.from([0]));
    }
    // Option<Pubkey>
    if (newAuthority) {
      parts.push(Buffer.from([1]), newAuthority.toBuffer());
    } else {
      parts.push(Buffer.from([0]));
    }
    // Option<Pubkey>
    if (newFeeVault) {
      parts.push(Buffer.from([1]), newFeeVault.toBuffer());
    } else {
      parts.push(Buffer.from([0]));
    }

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: false },
        { pubkey: configPDA, isSigner: false, isWritable: true },
      ],
      programId,
      data: Buffer.concat(parts),
    });
  }

  async buildCloseEscrowIx(
    escrowId: number,
  ): Promise<TransactionInstruction> {
    const [escrowPDA] = findEscrowPDA(this.walletPubkey, escrowId);
    const [vaultPDA] = findVaultPDA(escrowPDA);
    const disc = await getDiscriminator("close_escrow");

    return new TransactionInstruction({
      keys: [
        { pubkey: this.walletPubkey, isSigner: true, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data: disc,
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

  getConfigPDA(): PublicKey {
    const [pda] = findConfigPDA();
    return pda;
  }

  getEscrowPDA(escrowId: number): PublicKey {
    const [pda] = findEscrowPDA(this.walletPubkey, escrowId);
    return pda;
  }

  getVaultPDA(escrowId: number): PublicKey {
    const [escrowPDA] = findEscrowPDA(this.walletPubkey, escrowId);
    const [vaultPDA] = findVaultPDA(escrowPDA);
    return vaultPDA;
  }

  static getEscrowPDAForDepositor(depositor: PublicKey, escrowId: number): PublicKey {
    const [pda] = findEscrowPDA(depositor, escrowId);
    return pda;
  }
}
