"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { SolanaProvider } from "@/components/SolanaProvider";
import { WalletAuthSync } from "@/components/WalletAuthSync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SolanaProvider>
          <WalletAuthSync />
          <Toaster />
          {children}
        </SolanaProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
