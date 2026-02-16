"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { EscrowPhase } from "@shared/schema";

export function useMyEscrows() {
  return useQuery({
    queryKey: [api.escrow.myEscrows.path],
    queryFn: async () => {
      const res = await fetch(api.escrow.myEscrows.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to fetch escrows");
      }
      return res.json();
    },
  });
}

export function useEscrow(id: number) {
  return useQuery({
    queryKey: [api.escrow.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.escrow.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch escrow");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useEscrowByOrder(orderId: number) {
  return useQuery({
    queryKey: [api.escrow.getByOrder.path, orderId],
    queryFn: async () => {
      const url = buildUrl(api.escrow.getByOrder.path, { orderId });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch escrow");
      return res.json();
    },
    enabled: !!orderId,
  });
}

export function useCreateEscrow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { orderId: number; receiverId: string; amount: string; expiresInDays?: number }) => {
      const res = await fetch(api.escrow.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create escrow");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.escrow.myEscrows.path] });
    },
  });
}

export function useUpdateEscrowPhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, phase, txHash }: { id: number; phase: EscrowPhase; txHash?: string }) => {
      const url = buildUrl(api.escrow.updatePhase.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, txHash }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update escrow phase");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.escrow.myEscrows.path] });
    },
  });
}

export function useAddMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ escrowId, ...data }: { escrowId: number; title: string; description?: string; amount: string; targetMetric?: number; deadlineDays?: number }) => {
      const url = buildUrl(api.escrow.addMilestone.path, { escrowId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to add milestone");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.escrow.get.path] });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, proofUrl }: { id: number; status: string; proofUrl?: string }) => {
      const url = buildUrl(api.escrow.updateMilestone.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, proofUrl }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update milestone");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.escrow.get.path] });
    },
  });
}
