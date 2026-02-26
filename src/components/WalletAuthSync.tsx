"use client";

import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useRef } from "react";

/**
 * Bridges wallet-adapter state with session auth.
 * - Auto-login on fresh wallet connect
 * - Auto-logout on disconnect or wallet switch
 */
export function WalletAuthSync() {
  const { publicKey, connected, signMessage } = useSolanaWallet();
  const { user, isLoading, login, isLoggingIn, logout } = useAuth();
  const loginAttempted = useRef(false);
  const prevConnected = useRef(false);
  const prevAddress = useRef<string | null>(null);

  const address = publicKey?.toBase58() ?? null;

  // Detect wallet switch: address changed while still connected → logout old session
  useEffect(() => {
    if (address && prevAddress.current && address !== prevAddress.current && user) {
      // Wallet switched — destroy old session so new wallet can sign in
      logout();
      loginAttempted.current = false;
    }
    prevAddress.current = address;
  }, [address, user, logout]);

  // Auto-login on fresh wallet connection
  useEffect(() => {
    const justConnected = connected && !prevConnected.current;
    prevConnected.current = connected;

    if (
      justConnected &&
      address &&
      signMessage &&
      !user &&
      !isLoading &&
      !isLoggingIn &&
      !loginAttempted.current
    ) {
      loginAttempted.current = true;
      login(
        { walletAddress: address, signMessage },
        {
          onError: () => {
            loginAttempted.current = true; // don't retry — user can click "Sign In"
          },
        },
      );
    }
  }, [connected, address, signMessage, user, isLoading, isLoggingIn, login]);

  // Auto-logout when wallet disconnects
  useEffect(() => {
    if (!connected && user) {
      logout();
    }
  }, [connected, user, logout]);

  // Reset on disconnect
  useEffect(() => {
    if (!connected) {
      loginAttempted.current = false;
      prevConnected.current = false;
    }
  }, [connected]);

  return null;
}
