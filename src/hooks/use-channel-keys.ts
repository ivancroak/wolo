"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { deriveChannelKeysFromWallet } from "@/lib/solana/wallet-cipher";

const CHANNEL_KEY_MESSAGE = "Wolo: Authorize encrypted messaging channel";
const STORAGE_PREFIX = "wolo_channel_key_";

function getCacheKey(walletAddress: string) {
  return `${STORAGE_PREFIX}${walletAddress}`;
}

function loadCachedKeys(walletAddress: string): { publicKey: string; secretKey: string } | null {
  try {
    const raw = localStorage.getItem(getCacheKey(walletAddress));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.publicKey && parsed?.secretKey) return parsed;
  } catch { /* corrupt or unavailable */ }
  return null;
}

function saveCachedKeys(walletAddress: string, keys: { publicKey: string; secretKey: string }) {
  try {
    localStorage.setItem(getCacheKey(walletAddress), JSON.stringify(keys));
  } catch { /* quota or unavailable */ }
}

function clearCachedKeys(walletAddress: string) {
  try {
    localStorage.removeItem(getCacheKey(walletAddress));
  } catch { /* unavailable */ }
}

export function useChannelKeys() {
  const { signMessage, publicKey } = useSolanaWallet();
  const [keys, setKeys] = useState<{ publicKey: string; secretKey: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const prevWalletRef = useRef<string | null>(null);

  const walletAddress = publicKey?.toBase58() ?? null;

  useEffect(() => {
    const prev = prevWalletRef.current;
    prevWalletRef.current = walletAddress;

    if (prev && prev !== walletAddress) {
      clearCachedKeys(prev);
      setKeys(null);
    }

    if (!walletAddress) {
      setKeys(null);
      return;
    }

    const cached = loadCachedKeys(walletAddress);
    if (cached) {
      setKeys(cached);
      fetch("/api/channel-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: cached.publicKey }),
        credentials: "include",
      }).catch(() => {});
    }
  }, [walletAddress]);

  const deriveKeys = useCallback(async () => {
    if (!signMessage || !publicKey) throw new Error("Wallet not connected or does not support signing");

    setIsLoading(true);
    try {
      const message = new TextEncoder().encode(CHANNEL_KEY_MESSAGE);
      const signature = await signMessage(message);
      const derived = deriveChannelKeysFromWallet(signature);
      setKeys(derived);

      const addr = publicKey.toBase58();
      saveCachedKeys(addr, derived);

      await fetch("/api/channel-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: derived.publicKey }),
        credentials: "include",
      });

      return derived;
    } finally {
      setIsLoading(false);
    }
  }, [signMessage, publicKey]);

  return {
    channelKeys: keys,
    deriveKeys,
    isLoading,
    hasKeys: !!keys,
  };
}
