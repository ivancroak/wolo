"use client";

import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect } from "react";
import { useAuth } from "./use-auth";

// Module-level singleton — only one "pending sign in" flag across all hook instances.
// Set when user clicks Sign In while wallet is disconnected (connect first, then sign).
let pendingSignIn = false;

export function useWallet() {
  const { publicKey, connected, connecting, disconnect: solanaDisconnect, signMessage } = useSolanaWallet();
  const { setVisible } = useWalletModal();
  const { user, isLoading: authLoading, login, isLoggingIn, logout } = useAuth();

  const address = publicKey?.toBase58() ?? null;
  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  // Chain: user clicked Sign In → wallet just connected → now fire login().
  // Module-level pendingSignIn ensures only the first hook instance to see it fires.
  useEffect(() => {
    if (pendingSignIn && connected && address && signMessage && !user && !authLoading && !isLoggingIn) {
      pendingSignIn = false;
      login({ walletAddress: address, signMessage });
    }
  }, [connected, address, signMessage, user, authLoading, isLoggingIn, login]);

  // Reset if wallet disconnects before sign-in completes
  useEffect(() => {
    if (!connected) {
      pendingSignIn = false;
    }
  }, [connected]);

  // Single sign-in function: handles both "already connected" and "need to connect first"
  const signIn = useCallback(() => {
    if (connected && address && signMessage && !user && !isLoggingIn) {
      // Wallet already connected → sign in directly
      login({ walletAddress: address, signMessage });
    } else if (!connected) {
      // Wallet not connected → open chooser, sign in after connect
      pendingSignIn = true;
      setVisible(true);
    }
  }, [connected, address, signMessage, user, isLoggingIn, login, setVisible]);

  const disconnect = useCallback(() => {
    solanaDisconnect();
    logout();
  }, [solanaDisconnect, logout]);

  // Session exists but for a different wallet (user switched wallets)
  const walletMismatch = !!user && !!address && user.id !== address;
  // Authenticated = session exists AND matches current wallet
  const isAuthenticated = !!user && !walletMismatch;

  return {
    address,
    shortAddress,
    isConnecting: connecting,
    isConnected: connected,
    isAuthenticated,
    isAuthLoading: authLoading,
    isLoggingIn,
    canSignIn: connected && !!address && !!signMessage && !isAuthenticated && !isLoggingIn,
    error: null,
    connect: useCallback(() => setVisible(true), [setVisible]),
    signIn,
    disconnect,
  };
}
