"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useDealProposals(orderId: number) {
  return useQuery({
    queryKey: [api.proposals.list.path, orderId],
    queryFn: async () => {
      const url = buildUrl(api.proposals.list.path, { id: orderId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch proposals");
      }
      return res.json();
    },
    enabled: !!orderId,
    refetchInterval: 10000,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, ...data }: { orderId: number; proposedPrice?: string | null; proposedDeadlineDays?: number | null; proposedMinPostCount?: number | null; proposedPostsPerPeriod?: number | null; proposedThreadsPerPeriod?: number | null; proposedContentType?: string | null; proposedRequiredKeyword?: string | null; message?: string | null }) => {
      const url = buildUrl(api.proposals.create.path, { id: orderId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create proposal");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.proposals.list.path, variables.orderId] });
    },
  });
}

export function usePatchProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, proposalId, action }: { orderId: number; proposalId: number; action: "accept" | "reject" | "withdraw" }) => {
      const url = buildUrl(api.proposals.patch.path, { id: orderId, proposalId });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update proposal");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.proposals.list.path, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", variables.orderId] });
    },
  });
}
