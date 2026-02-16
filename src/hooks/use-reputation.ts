"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useReputation(userId: string) {
  return useQuery({
    queryKey: [api.reputation.get.path, userId],
    queryFn: async () => {
      const url = buildUrl(api.reputation.get.path, { userId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch reputation");
      return res.json();
    },
    enabled: !!userId,
  });
}

export function useMyReputation() {
  return useQuery({
    queryKey: [api.reputation.myReputation.path],
    queryFn: async () => {
      const res = await fetch(api.reputation.myReputation.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to fetch reputation");
      }
      return res.json();
    },
  });
}

export function useRateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { orderId: number; targetId: string; score: number; comment?: string }) => {
      const res = await fetch(api.reputation.rate.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to rate order");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reputation.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.reputation.myReputation.path] });
    },
  });
}
