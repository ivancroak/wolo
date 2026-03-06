export const ESCROW_PROGRAM_ID = process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID || "9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9";
export const REPUTATION_PROGRAM_ID = process.env.NEXT_PUBLIC_REPUTATION_PROGRAM_ID || "42PrQGNH4pCqyGwxrLMXnfkDzz5CTCFx71y2HjuHK9Vg";

// IDL copies from anchor build — kept in-tree so they deploy to Vercel
export { default as ESCROW_IDL } from "./idl/woland_escrow.json";
export { default as REPUTATION_IDL } from "./idl/woland_reputation.json";
