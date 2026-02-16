"use client";

import { useCallback, useMemo, useRef } from "react";
import { useConnection, useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { WolandReputationClient } from "@/lib/solana/reputation-client";

export function useSolanaReputation() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useSolanaWallet();
  const initializedUsers = useRef(new Set<string>());

  const client = useMemo(() => {
    if (!publicKey) return null;
    return new WolandReputationClient(connection, publicKey);
  }, [connection, publicKey]);

  const ensureReputation = useCallback(async (userAddress: string) => {
    if (!client || !publicKey) return;
    if (initializedUsers.current.has(userAddress)) return;

    const user = new PublicKey(userAddress);
    const repPDA = client.getReputationPDA(user);
    const info = await connection.getAccountInfo(repPDA);
    if (info) {
      initializedUsers.current.add(userAddress);
      return;
    }

    if (userAddress !== publicKey.toBase58()) return;

    const ix = await client.buildInitializeReputationIx();
    const tx = await client.buildTransaction([ix]);
    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    initializedUsers.current.add(userAddress);
  }, [client, publicKey, connection, sendTransaction]);

  const initializeReputation = useCallback(async () => {
    if (!client || !publicKey) throw new Error("Wallet not connected");
    await ensureReputation(publicKey.toBase58());
  }, [client, publicKey, ensureReputation]);

  const recordCompletion = useCallback(async (
    userAddress: string,
    escrowId: number,
    amount: number,
    isBuyer: boolean,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    await ensureReputation(userAddress);

    const user = new PublicKey(userAddress);
    const ix = await client.buildRecordCompletionIx(user, escrowId, amount, isBuyer);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction, ensureReputation]);

  const recordDispute = useCallback(async (
    userAddress: string,
    escrowId: number,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    await ensureReputation(userAddress);

    const user = new PublicKey(userAddress);
    const ix = await client.buildRecordDisputeIx(user, escrowId);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction, ensureReputation]);

  const submitRating = useCallback(async (
    targetAddress: string,
    escrowId: number,
    score: number,
    comment: string,
  ) => {
    if (!client || !publicKey) throw new Error("Wallet not connected");

    const target = new PublicKey(targetAddress);
    const ix = await client.buildSubmitRatingIx(target, escrowId, score, comment);
    const tx = await client.buildTransaction([ix]);

    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [client, publicKey, connection, sendTransaction]);

  return {
    isReady: !!client,
    initializeReputation,
    ensureReputation,
    recordCompletion,
    recordDispute,
    submitRating,
    getReputationPDA: (userAddress?: string) => {
      if (!client) return undefined;
      const user = userAddress ? new PublicKey(userAddress) : undefined;
      return client.getReputationPDA(user)?.toBase58();
    },
  };
}
