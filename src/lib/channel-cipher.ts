import nacl from "tweetnacl";
import util from "tweetnacl-util";

export interface SealedEnvelope {
  ciphertext: string;
  ephemeralPub: string;
  nonce: string;
}

function deriveChannelKeypair(walletSecret: Uint8Array): nacl.BoxKeyPair {
  const seed = new Uint8Array(64);
  seed.set(new TextEncoder().encode("woland-channel-v1"));
  seed.set(walletSecret.slice(0, 32), 18);
  const hash = nacl.hash(seed).slice(0, 32);
  return nacl.box.keyPair.fromSecretKey(hash);
}

export function generateChannelKeys(): {
  publicKey: string;
  secretKey: string;
} {
  const kp = nacl.box.keyPair();
  return {
    publicKey: util.encodeBase64(kp.publicKey),
    secretKey: util.encodeBase64(kp.secretKey),
  };
}

export function deriveChannelPublicKey(secretKeyBase64: string): string {
  const sk = util.decodeBase64(secretKeyBase64);
  const kp = nacl.box.keyPair.fromSecretKey(sk);
  return util.encodeBase64(kp.publicKey);
}

export function sealMessage(
  plaintext: string,
  recipientPubKeyBase64: string,
  senderSecretKeyBase64: string
): SealedEnvelope {
  const message = util.decodeUTF8(plaintext);
  const recipientPub = util.decodeBase64(recipientPubKeyBase64);
  const senderSecret = util.decodeBase64(senderSecretKeyBase64);
  const senderKp = nacl.box.keyPair.fromSecretKey(senderSecret);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  const encrypted = nacl.box(message, nonce, recipientPub, senderSecret);
  if (!encrypted) throw new Error("Encryption failed");

  return {
    ciphertext: util.encodeBase64(encrypted),
    ephemeralPub: util.encodeBase64(senderKp.publicKey),
    nonce: util.encodeBase64(nonce),
  };
}

export function openMessage(
  envelope: SealedEnvelope,
  recipientSecretKeyBase64: string
): string | null {
  try {
    const ciphertext = util.decodeBase64(envelope.ciphertext);
    const ephemeralPub = util.decodeBase64(envelope.ephemeralPub);
    const nonce = util.decodeBase64(envelope.nonce);
    const secretKey = util.decodeBase64(recipientSecretKeyBase64);

    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPub, secretKey);
    if (!decrypted) return null;
    return util.encodeUTF8(decrypted);
  } catch {
    return null;
  }
}
