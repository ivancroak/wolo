import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { createSession } from "@/server/auth";
import nacl from "tweetnacl";
import { consumeNonce } from "@/server/nonce-store";

function base58Decode(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]] = i;
  const bytes = [0];
  for (const char of str) {
    let carry = map[char];
    if (carry === undefined) throw new Error("Invalid base58");
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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { walletAddress, signature } = body;

  if (!walletAddress || typeof walletAddress !== "string") {
    return NextResponse.json({ message: "walletAddress required" }, { status: 400 });
  }
  if (!signature || typeof signature !== "string") {
    return NextResponse.json({ message: "signature required" }, { status: 400 });
  }

  const nonce = consumeNonce(walletAddress);
  if (!nonce) {
    return NextResponse.json({ message: "Nonce expired or not found. Request a new nonce." }, { status: 401 });
  }

  const message = `Sign in to Wolo\nWallet: ${walletAddress}\nNonce: ${nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = Uint8Array.from(Buffer.from(signature, "base64"));
  const publicKeyBytes = base58Decode(walletAddress);

  const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  if (!isValid) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  const user = await storage.upsertUser({
    id: walletAddress,
    email: null,
    firstName: null,
    lastName: null,
    profileImageUrl: null,
  });

  await createSession(user.id);
  return NextResponse.json(user);
}
