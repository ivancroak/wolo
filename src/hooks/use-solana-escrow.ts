"use client";

import { useCallback, useMemo } from "react";
import { useConnection, useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { WolandEscrowClient } from "@/lib/solana/escrow-client";

const PHASE_MAP: Record<string, number> = {
  awaiting_deposit: 0,
  funded: 1,
  in_progress: 2,
  under_review: 3,
  milestone_check: 4,
  released: 5,
  refunded: 6,
  disputed: 7,
};

const FEE_VAULT = process.env.NEXT_PUBLIC_FEE_VAULT || "";

export function useSolanaEscrow() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useSolanaWallet();

  const client = useMemo(() => {
    if (!publicKey) return null;
    return new WolandEscrowClient(connection, publicKey);
  }, [connection, publicKey]);

  const feeVault = useMemo(() => {
    if (!FEE_VAULT) return null;
    try { return new PublicKey(FEE_VAULT); } catch { return null; }
  }, []);

  const initializeAndFund = useCallback(async (
    receiverAddress: string,
    mintAddress: string,
    escrowId: number,
    amountLamports: number,
    expiresInDays: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    const receiver = new PublicKey(receiverAddress);
    const mint = new PublicKey(mintAddress);
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 86400;

    const initIx = await client.buildInitializeEscrowIx(
      receiver, mint, escrowId, amountLamports, expiresAt
    );
    const fundIx = await client.buildFundEscrowIx(escrowId, mint);
    const tx = await client.buildTransaction([initIx, fundIx]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction]);

  const advancePhase = useCallback(async (
    depositorAddress: string,
    escrowId: number,
    phase: string,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    const phaseNum = PHASE_MAP[phase];
    if (phaseNum === undefined) throw new Error("Invalid phase");

    const depositor = new PublicKey(depositorAddress);
    const ix = await client.buildAdvancePhaseIx(depositor, escrowId, phaseNum);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction]);

  const releaseFunds = useCallback(async (
    escrowId: number,
    receiverAddress: string,
    mintAddress: string,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");
    if (!feeVault) throw new Error("Fee vault not configured. Set NEXT_PUBLIC_FEE_VAULT in .env");

    const receiver = new PublicKey(receiverAddress);
    const mint = new PublicKey(mintAddress);
    const ix = await client.buildReleaseFundsIx(escrowId, receiver, mint, feeVault);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction, feeVault]);

  const releaseMilestone = useCallback(async (
    escrowId: number,
    receiverAddress: string,
    mintAddress: string,
    milestoneIdx: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");
    if (!feeVault) throw new Error("Fee vault not configured");

    const receiver = new PublicKey(receiverAddress);
    const mint = new PublicKey(mintAddress);
    const ix = await client.buildReleaseMilestoneIx(escrowId, receiver, mint, feeVault, milestoneIdx);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction, feeVault]);

  const addMilestone = useCallback(async (
    depositorAddress: string,
    escrowId: number,
    title: string,
    amount: number,
    deadlineOffsetSeconds: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    const depositor = new PublicKey(depositorAddress);
    const ix = await client.buildAddMilestoneIx(depositor, escrowId, title, amount, deadlineOffsetSeconds);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction]);

  const submitMilestone = useCallback(async (
    depositorAddress: string,
    escrowId: number,
    milestoneIdx: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    const depositor = new PublicKey(depositorAddress);
    const ix = await client.buildSubmitMilestoneIx(depositor, escrowId, milestoneIdx);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction]);

  const rejectMilestone = useCallback(async (
    depositorAddress: string,
    escrowId: number,
    milestoneIdx: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    const depositor = new PublicKey(depositorAddress);
    const ix = await client.buildRejectMilestoneIx(depositor, escrowId, milestoneIdx);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction]);

  const refund = useCallback(async (
    depositorAddress: string,
    escrowId: number,
    mintAddress: string,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    const depositor = new PublicKey(depositorAddress);
    const mint = new PublicKey(mintAddress);
    const ix = await client.buildRefundIx(depositor, escrowId, mint);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction]);

  const arbiterResolve = useCallback(async (
    depositorAddress: string,
    escrowId: number,
    receiverAddress: string,
    mintAddress: string,
    depositorShareBps: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");
    if (!feeVault) throw new Error("Fee vault not configured");

    const depositor = new PublicKey(depositorAddress);
    const receiver = new PublicKey(receiverAddress);
    const mint = new PublicKey(mintAddress);
    const ix = await client.buildArbiterResolveIx(depositor, escrowId, receiver, mint, feeVault, depositorShareBps);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction, feeVault]);

  const closeEscrow = useCallback(async (escrowId: number) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    const ix = await client.buildCloseEscrowIx(escrowId);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction]);

  const hasFeeVault = !!feeVault;

  return {
    isReady: !!client,
    isFullyConfigured: !!client && hasFeeVault,
    walletAddress: publicKey?.toBase58() ?? null,
    initializeAndFund,
    advancePhase,
    releaseFunds,
    releaseMilestone,
    addMilestone,
    submitMilestone,
    rejectMilestone,
    refund,
    arbiterResolve,
    closeEscrow,
    getEscrowPDA: (escrowId: number) => client?.getEscrowPDA(escrowId)?.toBase58(),
    getVaultPDA: (escrowId: number) => client?.getVaultPDA(escrowId)?.toBase58(),
  };
}
