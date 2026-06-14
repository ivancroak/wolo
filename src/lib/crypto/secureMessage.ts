/**
 * @module secureMessage
 *
 * Client-side end-to-end encryption for Wolo secure messages.
 *
 * Algorithm: NaCl box — Curve25519 key-exchange + XSalsa20-Poly1305 AEAD
 * (tweetnacl `nacl.box`). Each message uses a fresh random 24-byte nonce.
 *
 * All binary data is transported as Base64 strings (no Node Buffer — pure
 * Uint8Array + TextEncoder/TextDecoder, browser-safe).
 */

import nacl from "tweetnacl";

// ---------------------------------------------------------------------------
// Browser-safe Base64 helpers (no Buffer, no atob/btoa for binary safety)
// ---------------------------------------------------------------------------

/**
 * Encodes a Uint8Array to a Base64 string using only standard Web APIs.
 * Works in both browsers (TextDecoder) and Node.js ≥ 16.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  // Build a binary string then delegate to btoa (available everywhere)
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string back to a Uint8Array.
 */
function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A Curve25519 key-pair where both keys are Base64-encoded strings.
 * Store the `secretKey` client-side only — never send it to the server.
 */
export type MessagingKeyPair = {
  /** Curve25519 public key, Base64-encoded (32 bytes → 44 chars). */
  publicKey: string;
  /** Curve25519 secret key, Base64-encoded (32 bytes → 44 chars). */
  secretKey: string;
};

/**
 * An encrypted message ready to be stored server-side.
 * Both fields are Base64-encoded byte arrays.
 */
export type EncryptedMessage = {
  /** XSalsa20-Poly1305 ciphertext, Base64-encoded. */
  ciphertext: string;
  /** 24-byte random nonce used for this encryption, Base64-encoded. */
  nonce: string;
};

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/**
 * Generates a fresh Curve25519 key-pair for use with `encryptMessage` /
 * `decryptMessage`.
 *
 * @returns A `MessagingKeyPair` with Base64-encoded public and secret keys.
 *
 * @example
 * ```ts
 * const alice = generateMessagingKeyPair();
 * // alice.publicKey — share with conversation partners
 * // alice.secretKey — keep private, never leave the client
 * ```
 */
export function generateMessagingKeyPair(): MessagingKeyPair {
  const kp = nacl.box.keyPair();
  return {
    publicKey: uint8ToBase64(kp.publicKey),
    secretKey: uint8ToBase64(kp.secretKey),
  };
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext message for a specific recipient.
 *
 * Uses NaCl box (Diffie-Hellman key-exchange + XSalsa20-Poly1305):
 * - A fresh random 24-byte nonce is generated for every call, so identical
 *   plaintexts produce different ciphertexts (IND-CPA secure).
 * - Only the holder of `recipientSecretKey` can decrypt the result.
 *
 * @param plaintext              UTF-8 message content to encrypt.
 * @param recipientPublicKeyB64  Recipient's public key (Base64).
 * @param senderSecretKeyB64     Sender's secret key (Base64).
 * @returns `EncryptedMessage` containing Base64-encoded `ciphertext` and `nonce`.
 *
 * @example
 * ```ts
 * const encrypted = encryptMessage("Hello!", bob.publicKey, alice.secretKey);
 * ```
 */
export function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderSecretKeyB64: string
): EncryptedMessage {
  const recipientPk = base64ToUint8(recipientPublicKeyB64);
  const senderSk = base64ToUint8(senderSecretKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes
  const messageBytes = new TextEncoder().encode(plaintext);

  const ciphertextBytes = nacl.box(messageBytes, nonce, recipientPk, senderSk);

  return {
    ciphertext: uint8ToBase64(ciphertextBytes),
    nonce: uint8ToBase64(nonce),
  };
}

// ---------------------------------------------------------------------------
// Decryption
// ---------------------------------------------------------------------------

/**
 * Decrypts a message that was encrypted with `encryptMessage`.
 *
 * NaCl box provides authenticated encryption: if the ciphertext or nonce has
 * been tampered with, or if the wrong keys are supplied, an `Error` is thrown
 * rather than returning corrupted data.
 *
 * @param message               The `EncryptedMessage` object (ciphertext + nonce).
 * @param senderPublicKeyB64    Sender's public key (Base64) — used to verify authorship.
 * @param recipientSecretKeyB64 Recipient's secret key (Base64) — must match the
 *                              public key used during encryption.
 * @returns The decrypted UTF-8 plaintext string.
 * @throws {Error} If authentication fails (wrong keys, tampered data, etc.).
 *
 * @example
 * ```ts
 * const plaintext = decryptMessage(encrypted, alice.publicKey, bob.secretKey);
 * ```
 */
export function decryptMessage(
  message: EncryptedMessage,
  senderPublicKeyB64: string,
  recipientSecretKeyB64: string
): string {
  const senderPk = base64ToUint8(senderPublicKeyB64);
  const recipientSk = base64ToUint8(recipientSecretKeyB64);
  const nonce = base64ToUint8(message.nonce);
  const ciphertext = base64ToUint8(message.ciphertext);

  const decrypted = nacl.box.open(ciphertext, nonce, senderPk, recipientSk);

  if (decrypted === null) {
    throw new Error(
      "Decryption failed: authentication tag mismatch. " +
        "The message may have been tampered with, or the keys are incorrect."
    );
  }

  return new TextDecoder().decode(decrypted);
}
