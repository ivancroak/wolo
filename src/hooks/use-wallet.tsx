"use client";

import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback } from "react";
import { useAuth } from "./use-auth";

export function useWallet() {
  const { publicKey, connected, connecting, disconnect: solanaDisconnect, signMessage } = useSolanaWallet();
  const { setVisible } = useWalletModal();
  const { user, isLoading: authLoading, login, isLoggingIn, logout } = useAuth();

  const address = publicKey?.toBase58() ?? null;
  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  const connect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  // Explicitly trigger the nonce→sign→session flow
  const signIn = useCallback(() => {
    if (address && signMessage) {
      login({ walletAddress: address, signMessage });
    }
  }, [address, signMessage, login]);

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
    connect,
    signIn,
    disconnect,
  };
}
