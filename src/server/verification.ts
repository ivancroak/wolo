import { getRetweeters, checkFollowRelationship } from "./twitter-client";
import type { ServiceCategory } from "@shared/schema";

export type VerificationStatus = "verified" | "not_found" | "manual_only" | "error";

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
  details?: Record<string, any>;
}

export function parseTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

export async function verifyDelivery(
  category: ServiceCategory,
  sellerHandle: string,
  opts: { tweetUrl?: string; targetHandle?: string },
): Promise<VerificationResult> {
  const normalizedSeller = sellerHandle.replace(/^@/, "").toLowerCase();

  switch (category) {
    case "repost": {
      if (!opts.tweetUrl) {
        return { status: "error", message: "Tweet URL is required for repost verification" };
      }
      const tweetId = parseTweetId(opts.tweetUrl);
      if (!tweetId) {
        return { status: "error", message: "Invalid tweet URL" };
      }
      try {
        const retweeters = await getRetweeters(tweetId);
        const found = retweeters.includes(normalizedSeller);
        return found
          ? { status: "verified", message: `@${normalizedSeller} retweeted this tweet`, details: { tweetId } }
          : { status: "not_found", message: `@${normalizedSeller} was not found in the retweeters list`, details: { tweetId, checked: retweeters.length } };
      } catch (err: any) {
        return { status: "error", message: err?.message ?? "Failed to check retweeters" };
      }
    }

    case "like":
      return {
        status: "manual_only",
        message: "Like verification is not available via API. Please review manually.",
      };

    case "follow": {
      if (!opts.targetHandle) {
        return { status: "error", message: "Target @handle is required for follow verification" };
      }
      const normalizedTarget = opts.targetHandle.replace(/^@/, "").toLowerCase();
      try {
        const rel = await checkFollowRelationship(normalizedSeller, normalizedTarget);
        return rel.following
          ? { status: "verified", message: `@${normalizedSeller} follows @${normalizedTarget}`, details: rel }
          : { status: "not_found", message: `@${normalizedSeller} does not follow @${normalizedTarget}`, details: rel };
      } catch (err: any) {
        return { status: "error", message: err?.message ?? "Failed to check follow relationship" };
      }
    }

    case "ambassador":
    case "custom":
      return {
        status: "manual_only",
        message: "This category requires manual verification. Please review the seller's proof.",
      };

    default:
      return { status: "error", message: `Unknown category: ${category}` };
  }
}
