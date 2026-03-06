"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { User } from "@shared/models/auth";
import { apiRequest } from "@/lib/queryClient";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

// Module-level singleton — prevents multiple hook instances from firing login concurrently
let loginInFlight = false;

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ walletAddress, signMessage }: {
      walletAddress: string;
      signMessage: (message: Uint8Array) => Promise<Uint8Array>;
    }) => {
      const nonceRes = await apiRequest("POST", "/api/auth/nonce", { walletAddress });
      const { nonce } = await nonceRes.json();

      const message = `Sign in to Wolo\nWallet: ${walletAddress}\nNonce: ${nonce}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = Buffer.from(signatureBytes).toString("base64");

      const res = await apiRequest("POST", "/api/auth/login", { walletAddress, signature });
      return res.json();
    },
    onSuccess: (data) => {
      loginInFlight = false;
      queryClient.setQueryData(["/api/auth/user"], data);
    },
    onError: () => {
      loginInFlight = false;
    },
  });

  const login = useCallback(
    (args: { walletAddress: string; signMessage: (message: Uint8Array) => Promise<Uint8Array> }) => {
      if (loginInFlight) return;
      loginInFlight = true;
      loginMutation.mutate(args);
    },
    [loginMutation],
  );

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
