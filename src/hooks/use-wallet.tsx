"use client";

import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect } from "react";
import { useAuth } from "./use-auth";

let prevConnected = false;
let loginInProgress = false;

export function useWallet() {
  const { publicKey, connected, connecting, disconnect: solanaDisconnect, signMessage } = useSolanaWallet();
  const { setVisible } = useWalletModal();
  const { login, logout } = useAuth();

  const address = publicKey?.toBase58() ?? null;
  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  useEffect(() => {
    if (connected && address && signMessage && !prevConnected && !loginInProgress) {
      prevConnected = true;
      loginInProgress = true;
      login(
        { walletAddress: address, signMessage },
        { onSettled: () => { loginInProgress = false; } },
      );
    }
    if (!connected && prevConnected) {
      prevConnected = false;
      logout();
      loginInProgress = false;
    }
  }, [connected, address, signMessage, login, logout]);

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
