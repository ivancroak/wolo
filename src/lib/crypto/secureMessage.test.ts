/**
 * Tests for src/lib/crypto/secureMessage.ts
 *
 * Covers: round-trip encryption, wrong-key decryption failure, tampering
 * detection, nonce uniqueness, and type-level guarantees.
 */

import { describe, it, expect } from "vitest";
import {
  generateMessagingKeyPair,
  encryptMessage,
  decryptMessage,
  type MessagingKeyPair,
  type EncryptedMessage,
} from "./secureMessage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeParties(): { alice: MessagingKeyPair; bob: MessagingKeyPair } {
  return {
    alice: generateMessagingKeyPair(),
    bob: generateMessagingKeyPair(),
  };
}

// ---------------------------------------------------------------------------
// Key-pair generation
// ---------------------------------------------------------------------------
describe("generateMessagingKeyPair", () => {
  it("returns non-empty base64 strings for public and secret keys", () => {
    const kp = generateMessagingKeyPair();
    expect(typeof kp.publicKey).toBe("string");
    expect(typeof kp.secretKey).toBe("string");
    expect(kp.publicKey.length).toBeGreaterThan(0);
    expect(kp.secretKey.length).toBeGreaterThan(0);
  });

  it("returns Curve25519 keys of correct decoded length (32 bytes → 44 Base64 chars)", () => {
    const kp = generateMessagingKeyPair();
    // 32 bytes in Base64 = ceil(32/3)*4 = 44 characters
    expect(kp.publicKey.length).toBe(44);
    expect(kp.secretKey.length).toBe(44);
  });

  it("generates unique key-pairs on each call", () => {
    const kp1 = generateMessagingKeyPair();
    const kp2 = generateMessagingKeyPair();
    expect(kp1.publicKey).not.toBe(kp2.publicKey);
    expect(kp1.secretKey).not.toBe(kp2.secretKey);
  });
});

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------
describe("encryptMessage", () => {
  it("returns an EncryptedMessage with ciphertext and nonce strings", () => {
    const { alice, bob } = makeParties();
    const enc = encryptMessage("hello", bob.publicKey, alice.secretKey);
    expect(typeof enc.ciphertext).toBe("string");
    expect(typeof enc.nonce).toBe("string");
    expect(enc.ciphertext.length).toBeGreaterThan(0);
    expect(enc.nonce.length).toBeGreaterThan(0);
  });

  it("produces a 24-byte nonce (32 Base64 chars)", () => {
    const { alice, bob } = makeParties();
    const enc = encryptMessage("test", bob.publicKey, alice.secretKey);
    // 24 bytes → 32 Base64 chars
    expect(enc.nonce.length).toBe(32);
  });

  it("two encryptions of the same plaintext produce different nonces", () => {
    const { alice, bob } = makeParties();
    const enc1 = encryptMessage("same text", bob.publicKey, alice.secretKey);
    const enc2 = encryptMessage("same text", bob.publicKey, alice.secretKey);
    expect(enc1.nonce).not.toBe(enc2.nonce);
  });

  it("two encryptions of the same plaintext produce different ciphertexts", () => {
    const { alice, bob } = makeParties();
    const enc1 = encryptMessage("same text", bob.publicKey, alice.secretKey);
    const enc2 = encryptMessage("same text", bob.publicKey, alice.secretKey);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });
});

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------
describe("encryptMessage → decryptMessage round-trip", () => {
  it("decrypts a short ASCII message correctly", () => {
    const { alice, bob } = makeParties();
    const plaintext = "Hello, Wolo!";
    const enc = encryptMessage(plaintext, bob.publicKey, alice.secretKey);
    const dec = decryptMessage(enc, alice.publicKey, bob.secretKey);
    expect(dec).toBe(plaintext);
  });

  it("decrypts a long message correctly", () => {
    const { alice, bob } = makeParties();
    const plaintext = "A".repeat(10_000);
    const enc = encryptMessage(plaintext, bob.publicKey, alice.secretKey);
    const dec = decryptMessage(enc, alice.publicKey, bob.secretKey);
    expect(dec).toBe(plaintext);
  });

  it("decrypts an empty string correctly", () => {
    const { alice, bob } = makeParties();
    const enc = encryptMessage("", bob.publicKey, alice.secretKey);
    const dec = decryptMessage(enc, alice.publicKey, bob.secretKey);
    expect(dec).toBe("");
  });

  it("round-trips a UTF-8 / emoji message", () => {
    const { alice, bob } = makeParties();
    const plaintext = "Привет 🌍 مرحبا こんにちは";
    const enc = encryptMessage(plaintext, bob.publicKey, alice.secretKey);
    const dec = decryptMessage(enc, alice.publicKey, bob.secretKey);
    expect(dec).toBe(plaintext);
  });

  it("alice can encrypt a message TO herself (self-message)", () => {
    const alice = generateMessagingKeyPair();
    const plaintext = "note to self";
    const enc = encryptMessage(plaintext, alice.publicKey, alice.secretKey);
    const dec = decryptMessage(enc, alice.publicKey, alice.secretKey);
    expect(dec).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// Authentication failures
// ---------------------------------------------------------------------------
describe("decryptMessage – authentication failures", () => {
  it("throws when decrypted with the wrong recipient key", () => {
    const { alice, bob } = makeParties();
    const carol = generateMessagingKeyPair();
    const enc = encryptMessage("secret", bob.publicKey, alice.secretKey);
    // Carol tries to open bob's message
    expect(() => decryptMessage(enc, alice.publicKey, carol.secretKey)).toThrow(
      /Decryption failed/
    );
  });

  it("throws when decrypted with the wrong sender key", () => {
    const { alice, bob } = makeParties();
    const carol = generateMessagingKeyPair();
    const enc = encryptMessage("secret", bob.publicKey, alice.secretKey);
    // Bob tries to verify sender is Carol instead of Alice — auth fails
    expect(() => decryptMessage(enc, carol.publicKey, bob.secretKey)).toThrow(
      /Decryption failed/
    );
  });

  it("throws when the ciphertext has been tampered with (single byte flip)", () => {
    const { alice, bob } = makeParties();
    const enc = encryptMessage("tamper me", bob.publicKey, alice.secretKey);

    // Decode, flip one byte, re-encode
    const decoded = Uint8Array.from(atob(enc.ciphertext), (c) =>
      c.charCodeAt(0)
    );
    decoded[0] ^= 0xff;
    let binary = "";
    for (let i = 0; i < decoded.length; i++) binary += String.fromCharCode(decoded[i]);
    const tampered: EncryptedMessage = { ...enc, ciphertext: btoa(binary) };

    expect(() => decryptMessage(tampered, alice.publicKey, bob.secretKey)).toThrow(
      /Decryption failed/
    );
  });

  it("throws when the nonce has been replaced", () => {
    const { alice, bob } = makeParties();
    const enc = encryptMessage("nonce test", bob.publicKey, alice.secretKey);
    const enc2 = encryptMessage("different", bob.publicKey, alice.secretKey);
    // Swap the nonce from a different message
    const mixed: EncryptedMessage = { ciphertext: enc.ciphertext, nonce: enc2.nonce };
    expect(() => decryptMessage(mixed, alice.publicKey, bob.secretKey)).toThrow(
      /Decryption failed/
    );
  });
});
