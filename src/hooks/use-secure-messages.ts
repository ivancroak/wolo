"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useSecureMessages(orderId: number) {
  return useQuery({
    queryKey: [api.messages.list.path, orderId],
    queryFn: async () => {
      const url = buildUrl(api.messages.list.path, { orderId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to fetch messages");
      }
      return res.json();
    },
    enabled: !!orderId,
    refetchInterval: 5000,
  });
}

export function useSendSecureMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, content }: { orderId: number; content: string }) => {
      const url = buildUrl(api.messages.send.path, { orderId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path, variables.orderId] });
    },
  });
}
