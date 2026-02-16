import { randomBytes } from "crypto";

const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();
const NONCE_TTL = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

function cleanupExpired() {
  const now = Date.now();
  nonceStore.forEach((entry, key) => {
    if (now > entry.expiresAt) nonceStore.delete(key);
  });
}

setInterval(cleanupExpired, CLEANUP_INTERVAL);

export function createNonce(walletAddress: string): string {
  cleanupExpired();
  const nonce = randomBytes(32).toString("hex");
  nonceStore.set(walletAddress, { nonce, expiresAt: Date.now() + NONCE_TTL });
  return nonce;
}

export function consumeNonce(walletAddress: string): string | null {
  const entry = nonceStore.get(walletAddress);
  if (!entry || Date.now() > entry.expiresAt) {
    nonceStore.delete(walletAddress);
    return null;
  }
  nonceStore.delete(walletAddress);
  return entry.nonce;
}
