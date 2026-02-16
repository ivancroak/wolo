import nacl from "tweetnacl";
import util from "tweetnacl-util";
import type { SealedEnvelope } from "@/lib/channel-cipher";

export function deriveChannelKeysFromWallet(signatureBytes: Uint8Array): {
  publicKey: string;
  secretKey: string;
} {
  const seed = nacl.hash(signatureBytes).slice(0, 32);
  const kp = nacl.box.keyPair.fromSecretKey(seed);
  return {
    publicKey: util.encodeBase64(kp.publicKey),
    secretKey: util.encodeBase64(kp.secretKey),
  };
}

export function sealWithWalletKey(
  plaintext: string,
  recipientPubKeyBase64: string,
): SealedEnvelope {
  const message = util.decodeUTF8(plaintext);
  const recipientPub = util.decodeBase64(recipientPubKeyBase64);
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  const encrypted = nacl.box(message, nonce, recipientPub, ephemeral.secretKey);
  if (!encrypted) throw new Error("Encryption failed");

  return {
    ciphertext: util.encodeBase64(encrypted),
    ephemeralPub: util.encodeBase64(ephemeral.publicKey),
    nonce: util.encodeBase64(nonce),
  };
}

export function openWithWalletKey(
  envelope: SealedEnvelope,
  secretKeyBase64: string,
): string | null {
  try {
    const ciphertext = util.decodeBase64(envelope.ciphertext);
    const ephemeralPub = util.decodeBase64(envelope.ephemeralPub);
    const nonce = util.decodeBase64(envelope.nonce);
    const secretKey = util.decodeBase64(secretKeyBase64);

    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPub, secretKey);
    if (!decrypted) return null;
    return util.encodeUTF8(decrypted);
  } catch {
    return null;
  }
}
