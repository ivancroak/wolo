"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export function useWatchlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["/api/watchlist"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch watchlist");
      return res.json();
    },
    enabled: !!user,
  });
}

export function useWatchedIds() {
  const { user } = useAuth();
  return useQuery<string[]>({
    queryKey: ["/api/watchlist/ids"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist/ids", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch watched ids");
      return res.json();
    },
    enabled: !!user,
  });
}

export function useToggleWatchlist() {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async (watchedUserId: string) => {
      const res = await apiRequest("POST", "/api/watchlist", { watchedUserId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist/ids"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (watchedUserId: string) => {
      await apiRequest("DELETE", `/api/watchlist/${watchedUserId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist/ids"] });
    },
  });

  return { addMutation, removeMutation };
}
