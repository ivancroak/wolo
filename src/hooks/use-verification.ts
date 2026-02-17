"use client";

import { useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

interface VerifyMilestoneInput {
  milestoneId: number;
  tweetUrl?: string;
  targetHandle?: string;
}

export interface VerificationResult {
  status: "verified" | "not_found" | "manual_only" | "error";
  message: string;
  details?: Record<string, any>;
}

export function useVerifyMilestone() {
  return useMutation({
    mutationFn: async ({ milestoneId, tweetUrl, targetHandle }: VerifyMilestoneInput): Promise<VerificationResult> => {
      const base = buildUrl(api.verify.milestone.path, { milestoneId });
      const params = new URLSearchParams();
      if (tweetUrl) params.set("tweetUrl", tweetUrl);
      if (targetHandle) params.set("targetHandle", targetHandle);
      const qs = params.toString();
      const url = qs ? `${base}?${qs}` : base;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Verification failed" }));
        throw new Error(err.message || "Verification failed");
      }
      return res.json();
    },
  });
}
