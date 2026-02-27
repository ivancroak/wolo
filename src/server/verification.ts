import { getUserTweets } from "./twitter-client";
import type { Service } from "@shared/schema";

export type VerificationStatus = "verified" | "not_found" | "insufficient" | "manual_only" | "error";

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
  matchingPosts: number;
  requiredPosts: number;
}

export async function verifyContract(
  service: Service,
  sellerHandle: string,
  _contractStartDate?: Date | null,
): Promise<VerificationResult> {
  if (service.category === "space") {
    return { status: "manual_only", message: "Space services require manual verification.", matchingPosts: 0, requiredPosts: 0 };
  }

  const keyword = service.requiredKeyword;
  if (!keyword) {
    return { status: "manual_only", message: "No required keyword set for this service.", matchingPosts: 0, requiredPosts: 0 };
  }

  const requiredCount = service.pricingCategory === "payroll"
    ? (service.postsPerPeriod ?? 1)
    : (service.minPostCount ?? 1);

  const normalizedHandle = sellerHandle.replace(/^@/, "");

  try {
    const tweets = await getUserTweets(normalizedHandle);
    const lowerKeyword = keyword.toLowerCase();
    const matching = tweets.filter((t) => t.text.toLowerCase().includes(lowerKeyword));

    if (matching.length >= requiredCount) {
      return {
        status: "verified",
        message: `Found ${matching.length} posts containing "${keyword}" (required: ${requiredCount})`,
        matchingPosts: matching.length,
        requiredPosts: requiredCount,
      };
    }

    if (matching.length > 0) {
      return {
        status: "insufficient",
        message: `Found ${matching.length} posts containing "${keyword}" but ${requiredCount} required`,
        matchingPosts: matching.length,
        requiredPosts: requiredCount,
      };
    }

    return {
      status: "not_found",
      message: `No posts containing "${keyword}" found in @${normalizedHandle}'s recent tweets`,
      matchingPosts: 0,
      requiredPosts: requiredCount,
    };
  } catch (err: any) {
    return {
      status: "error",
      message: err?.message ?? "Failed to fetch tweets for verification",
      matchingPosts: 0,
      requiredPosts: requiredCount,
    };
  }
}
