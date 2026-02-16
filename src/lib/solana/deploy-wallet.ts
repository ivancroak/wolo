import "server-only";
import { Keypair, PublicKey } from "@solana/web3.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(str: string): Uint8Array {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]] = i;

  const bytes = [0];
  for (const char of str) {
    const val = map[char];
    if (val === undefined) throw new Error("Invalid base58 character: " + char);
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char === "1") bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

export function getDeployWalletKeypair(): Keypair {
  const privKey = process.env.SOLANA_DEPLOY_WALLET_PRIVATE_KEY;
  if (!privKey) throw new Error("SOLANA_DEPLOY_WALLET_PRIVATE_KEY not set in .env");
  return Keypair.fromSecretKey(base58Decode(privKey));
}

export function getDeployWalletAddress(): PublicKey {
  const addr = process.env.SOLANA_DEPLOY_WALLET_ADDRESS;
  if (addr) return new PublicKey(addr);
  return getDeployWalletKeypair().publicKey;
}
