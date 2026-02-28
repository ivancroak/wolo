"use client";

import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useRef } from "react";

/**
 * Bridges wallet-adapter state with session auth.
 * - Auto-logout on disconnect or wallet switch
 * (Auto-login is handled by ConnectWallet component)
 */
export function WalletAuthSync() {
  const { publicKey, connected } = useSolanaWallet();
  const { user, logout } = useAuth();
  const prevAddress = useRef<string | null>(null);

  const address = publicKey?.toBase58() ?? null;

  // Detect wallet switch: address changed while still connected → logout old session
  useEffect(() => {
    if (address && prevAddress.current && address !== prevAddress.current && user) {
      logout();
    }
    prevAddress.current = address;
  }, [address, user, logout]);

  // Auto-logout when wallet disconnects
  useEffect(() => {
    if (!connected && user) {
      logout();
    }
  }, [connected, user, logout]);

  return null;
}
