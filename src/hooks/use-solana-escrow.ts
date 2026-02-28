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
    escrowId: number,
    amountLamports: number,
    expiresInDays: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    // Pre-flight: verify on-chain config PDA is initialized
    const configPDA = client.getConfigPDA();
    const configInfo = await connection.getAccountInfo(configPDA);
    if (!configInfo) {
      throw new Error(
        "Escrow program config is not initialized on-chain. " +
        "An admin must call POST /api/admin/init-config first."
      );
    }

    // Pre-flight: verify escrow PDA doesn't already exist (from a prior attempt)
    const escrowPDA = client.getEscrowPDA(escrowId);
    const escrowPDAKey = new PublicKey(escrowPDA!);
    const escrowInfo = await connection.getAccountInfo(escrowPDAKey);
    if (escrowInfo) {
      throw new Error(
        "Escrow account already exists on-chain. " +
        "This escrow may have been partially initialized in a previous attempt. " +
        "Try syncing via the API or contact support."
      );
    }

    // Pre-flight: check SOL balance
    const balance = await connection.getBalance(publicKey);
    const requiredLamports = amountLamports + 5_000_000; // escrow amount + ~0.005 SOL for rent + fees
    if (balance < requiredLamports) {
      throw new Error(
        `Insufficient SOL balance. You have ${(balance / 1e9).toFixed(4)} SOL ` +
        `but need ~${(requiredLamports / 1e9).toFixed(4)} SOL (amount + rent + fees).`
      );
    }

    const receiver = new PublicKey(receiverAddress);
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 86400;

    const ix = await client.buildInitializeEscrowIx(
      receiver, escrowId, amountLamports, expiresAt
    );
    const tx = await client.buildTransaction([ix]);

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
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");
    if (!feeVault) throw new Error("Fee vault not configured. Set NEXT_PUBLIC_FEE_VAULT in .env");

    const receiver = new PublicKey(receiverAddress);
    const ix = await client.buildReleaseFundsIx(escrowId, receiver, feeVault);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction, feeVault]);

  const releaseMilestone = useCallback(async (
    escrowId: number,
    receiverAddress: string,
    milestoneIdx: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");
    if (!feeVault) throw new Error("Fee vault not configured");

    const receiver = new PublicKey(receiverAddress);
    const ix = await client.buildReleaseMilestoneIx(escrowId, receiver, feeVault, milestoneIdx);
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
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    const depositor = new PublicKey(depositorAddress);
    const ix = await client.buildRefundIx(depositor, escrowId);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction]);

  const arbiterResolve = useCallback(async (
    depositorAddress: string,
    escrowId: number,
    receiverAddress: string,
    depositorShareBps: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");
    if (!feeVault) throw new Error("Fee vault not configured");

    const depositor = new PublicKey(depositorAddress);
    const receiver = new PublicKey(receiverAddress);
    const ix = await client.buildArbiterResolveIx(depositor, escrowId, receiver, feeVault, depositorShareBps);
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
  };
}
