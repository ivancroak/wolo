export const ESCROW_PROGRAM_ID = process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID || "4gVLZxZQuqKKw7JxDPdMUuZ6p33Ednh65mqJWwEsgGzM";
export const REPUTATION_PROGRAM_ID = process.env.NEXT_PUBLIC_REPUTATION_PROGRAM_ID || "CjNEAXDzVY5aTsHQaHuLMioVkUucu4aEwFZMTWWwXxvR";

// Generated IDLs from anchor build (target/idl/)
// These are Anchor v0.30+ format with discriminators and PDA seeds
export { default as ESCROW_IDL } from "../../../target/idl/woland_escrow.json";
export { default as REPUTATION_IDL } from "../../../target/idl/woland_reputation.json";
