"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PayrollPeriod } from "@shared/schema";

export function usePayrollPeriods(escrowId: number | undefined) {
  return useQuery<PayrollPeriod[]>({
    queryKey: ["/api/escrow/periods", escrowId],
    queryFn: async () => {
      const res = await fetch(`/api/escrow/${escrowId}/periods`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch payroll periods");
      }
      return res.json();
    },
    enabled: !!escrowId,
  });
}

export function useDisputePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ escrowId, periodId, reason }: { escrowId: number; periodId: number; reason?: string }) => {
      const res = await fetch(`/api/escrow/${escrowId}/periods/${periodId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to dispute period" }));
        throw new Error(err.message || "Failed to dispute period");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/escrow/periods", variables.escrowId] });
    },
  });
}
