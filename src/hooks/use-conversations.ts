"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export interface Conversation {
  orderId: number;
  serviceId: number;
  serviceTitle: string;
  counterpartyId: string;
  counterpartyHandle: string | null;
  role: "buyer" | "seller";
  orderStatus: string;
  createdAt: string | null;
}

export function useMyConversations() {
  return useQuery<Conversation[]>({
    queryKey: [api.conversations.list.path],
    queryFn: async () => {
      const res = await fetch(api.conversations.list.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch conversations");
      }
      return res.json();
    },
    refetchInterval: 30000,
  });
}
