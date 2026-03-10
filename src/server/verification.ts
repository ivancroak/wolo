import { getUserTweets, getRetweeters, checkFollowRelationship } from "./twitter-client";
import type { Service } from "@shared/schema";

export type VerificationStatus = "verified" | "not_found" | "insufficient" | "manual_only" | "error";

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
  matchingPosts: number;
  requiredPosts: number;
}

interface MilestoneParams {
  type: "post_tweets" | "retweet" | "follow";
  keyword?: string;
  postCount?: number;
  tweetUrl?: string;
  targetHandle?: string;
}

export function parseMilestoneParams(description: string): MilestoneParams | null {
  try {
    const parsed = JSON.parse(description);
    if (parsed && parsed.type) return parsed as MilestoneParams;
  } catch {}
  return null;
}

function extractTweetId(urlOrId: string): string | null {
  const match = urlOrId.match(/status\/(\d+)/);
  if (match) return match[1];
  if (/^\d+$/.test(urlOrId.trim())) return urlOrId.trim();
  return null;
}

export async function verifyMilestoneParams(
  params: MilestoneParams,
  sellerHandle: string,
  contractStartDate?: Date | null,
): Promise<VerificationResult> {
  const normalizedSeller = sellerHandle.replace(/^@/, "").toLowerCase();

  try {
    switch (params.type) {
      case "post_tweets": {
        const keyword = params.keyword;
        const requiredCount = params.postCount ?? 1;
        if (!keyword) {
          return { status: "manual_only", message: "No keyword specified.", matchingPosts: 0, requiredPosts: requiredCount };
        }

        let tweets = await getUserTweets(normalizedSeller, contractStartDate ? new Date(contractStartDate) : undefined);

        if (contractStartDate) {
          const startMs = new Date(contractStartDate).getTime();
          tweets = tweets.filter((t) => {
            if (!t.createdAt) return true;
            return new Date(t.createdAt).getTime() >= startMs;
          });
        }

        const lowerKeyword = keyword.toLowerCase();
        const matching = tweets.filter((t) => t.text.toLowerCase().includes(lowerKeyword));

        if (matching.length >= requiredCount) {
          return {
            status: "verified",
            message: `Found ${matching.length} posts with "${keyword}" (required: ${requiredCount})`,
            matchingPosts: matching.length,
            requiredPosts: requiredCount,
          };
        }
        if (matching.length > 0) {
          return {
            status: "insufficient",
            message: `Found ${matching.length} of ${requiredCount} required posts with "${keyword}"`,
            matchingPosts: matching.length,
            requiredPosts: requiredCount,
          };
        }
        return {
          status: "not_found",
          message: `No posts with "${keyword}" found from @${normalizedSeller}`,
          matchingPosts: 0,
          requiredPosts: requiredCount,
        };
      }

      case "retweet": {
        const tweetId = params.tweetUrl ? extractTweetId(params.tweetUrl) : null;
        if (!tweetId) {
          return { status: "error", message: "Invalid tweet URL or ID.", matchingPosts: 0, requiredPosts: 1 };
        }

        const retweeters = await getRetweeters(tweetId);
        const found = retweeters.includes(normalizedSeller);

        return {
          status: found ? "verified" : "not_found",
          message: found
            ? `@${normalizedSeller} retweeted the tweet`
            : `@${normalizedSeller} has not retweeted the tweet`,
          matchingPosts: found ? 1 : 0,
          requiredPosts: 1,
        };
      }

      case "follow": {
        const target = (params.targetHandle || "").replace(/^@/, "");
        if (!target) {
          return { status: "error", message: "No target handle specified.", matchingPosts: 0, requiredPosts: 1 };
        }

        const rel = await checkFollowRelationship(normalizedSeller, target);
        return {
          status: rel.following ? "verified" : "not_found",
          message: rel.following
            ? `@${normalizedSeller} is following @${target}`
            : `@${normalizedSeller} is not following @${target}`,
          matchingPosts: rel.following ? 1 : 0,
          requiredPosts: 1,
        };
      }

      default:
        return { status: "manual_only", message: "Unknown milestone type.", matchingPosts: 0, requiredPosts: 0 };
    }
  } catch (err: any) {
    return {
      status: "error",
      message: err?.message ?? "Verification failed",
      matchingPosts: 0,
      requiredPosts: 0,
    };
  }
}

export async function verifyContract(
  service: Service,
  sellerHandle: string,
  contractStartDate?: Date | null,
  keywordOverride?: string | null,
): Promise<VerificationResult> {
  const keyword = keywordOverride ?? service.requiredKeyword;
  if (!keyword) {
    return { status: "manual_only", message: "No required keyword set for this service.", matchingPosts: 0, requiredPosts: 0 };
  }

  const requiredCount = service.pricingCategory === "payroll"
    ? (service.postsPerPeriod ?? 1)
    : (service.minPostCount ?? 1);

  const normalizedHandle = sellerHandle.replace(/^@/, "");

  try {
    let tweets = await getUserTweets(normalizedHandle, contractStartDate ? new Date(contractStartDate) : undefined);

    if (contractStartDate) {
      const startMs = new Date(contractStartDate).getTime();
      tweets = tweets.filter((t) => {
        if (!t.createdAt) return true;
        return new Date(t.createdAt).getTime() >= startMs;
      });
    }

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
