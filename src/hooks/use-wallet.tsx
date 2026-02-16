"use client";

import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "./use-auth";
import { useSolanaReputation } from "./use-solana-reputation";

export function useWallet() {
  const { publicKey, connected, connecting, disconnect: solanaDisconnect, signMessage } = useSolanaWallet();
  const { setVisible } = useWalletModal();
  const { login, logout } = useAuth();
  const { ensureReputation, isReady: repReady } = useSolanaReputation();
  const prevConnected = useRef(false);
  const repInitialized = useRef(false);

  const address = publicKey?.toBase58() ?? null;
  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  useEffect(() => {
    if (connected && address && signMessage && !prevConnected.current) {
      login({ walletAddress: address, signMessage });
    }
    if (!connected && prevConnected.current) {
      logout();
      repInitialized.current = false;
    }
    prevConnected.current = connected;
  }, [connected, address, signMessage, login, logout]);

  useEffect(() => {
    if (repReady && address && !repInitialized.current) {
      repInitialized.current = true;
      ensureReputation(address).catch(() => {});
    }
  }, [repReady, address, ensureReputation]);

  const connect = useCallback(async () => {
    setVisible(true);
  }, [setVisible]);

  const disconnect = useCallback(() => {
    solanaDisconnect();
    logout();
  }, [solanaDisconnect, logout]);

  return {
    address,
    shortAddress,
    isConnecting: connecting,
    isConnected: connected,
    error: null,
    connect,
    disconnect,
  };
}
