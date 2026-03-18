"use client";

import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "./use-auth";

// Module-level singleton — only one "pending sign in" flag across all hook instances.
let pendingSignIn = false;

export function useWallet() {
  const { publicKey, connected, connecting, disconnect: solanaDisconnect, signMessage } = useSolanaWallet();
  const { visible, setVisible } = useWalletModal();
  const { user, isLoading: authLoading, login, isLoggingIn, logout } = useAuth();
  const wasModalOpen = useRef(false);

  const address = publicKey?.toBase58() ?? null;
  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  // Chain: user clicked Sign In → wallet just connected → now fire login().
  useEffect(() => {
    if (pendingSignIn && connected && address && signMessage && !user && !authLoading && !isLoggingIn) {
      pendingSignIn = false;
      login({ walletAddress: address, signMessage });
    }
  }, [connected, address, signMessage, user, authLoading, isLoggingIn, login]);

  // When modal closes while wallet is already connected (user re-selected same wallet),
  // fire login if we were waiting.
  useEffect(() => {
    if (visible) {
      wasModalOpen.current = true;
    } else if (wasModalOpen.current) {
      wasModalOpen.current = false;
      if (pendingSignIn && connected && address && signMessage && !user && !authLoading && !isLoggingIn) {
        pendingSignIn = false;
        login({ walletAddress: address, signMessage });
      }
    }
  }, [visible, connected, address, signMessage, user, authLoading, isLoggingIn, login]);

  // Reset if wallet disconnects before sign-in completes
  useEffect(() => {
    if (!connected) {
      pendingSignIn = false;
    }
  }, [connected]);

  // Always show wallet chooser so the user can pick/switch wallets.
  const signIn = useCallback(() => {
    if (isLoggingIn) return;
    pendingSignIn = true;
    setVisible(true);
  }, [isLoggingIn, setVisible]);

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
