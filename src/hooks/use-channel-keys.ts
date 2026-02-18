"use client";

import { useState, useCallback } from "react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { deriveChannelKeysFromWallet } from "@/lib/solana/wallet-cipher";

const CHANNEL_KEY_MESSAGE = "Wolo: Authorize encrypted messaging channel";

export function useChannelKeys() {
  const { signMessage, publicKey } = useSolanaWallet();
  const [keys, setKeys] = useState<{ publicKey: string; secretKey: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const deriveKeys = useCallback(async () => {
    if (!signMessage || !publicKey) throw new Error("Wallet not connected or does not support signing");

    setIsLoading(true);
    try {
      const message = new TextEncoder().encode(CHANNEL_KEY_MESSAGE);
      const signature = await signMessage(message);
      const derived = deriveChannelKeysFromWallet(signature);
      setKeys(derived);

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
