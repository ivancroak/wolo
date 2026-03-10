"use client";

import { usePayrollPeriods, useDisputePeriod } from "@/hooks/use-payroll-periods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, Clock, AlertTriangle, XCircle, Circle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSolanaReputation } from "@/hooks/use-solana-reputation";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useState } from "react";
import type { Escrow, PayrollPeriod } from "@shared/schema";

const statusConfig: Record<string, { color: string; icon: typeof Circle; label: string }> = {
  pending: { color: "bg-gray-500/10 text-gray-500", icon: Circle, label: "Pending" },
  active: { color: "bg-blue-500/10 text-blue-600", icon: Clock, label: "Active" },
  delivered: { color: "bg-purple-500/10 text-purple-600", icon: Clock, label: "Delivered" },
  disputed: { color: "bg-red-500/10 text-red-600", icon: AlertTriangle, label: "Disputed" },
  paid: { color: "bg-green-500/10 text-green-600", icon: CheckCircle, label: "Paid" },
  skipped: { color: "bg-gray-500/10 text-gray-500", icon: XCircle, label: "Skipped" },
};

interface PayrollTimelineProps {
  escrow: Escrow;
  isDepositor: boolean;
}

export function PayrollTimeline({ escrow, isDepositor }: PayrollTimelineProps) {
  const { data: periods, isLoading } = usePayrollPeriods(escrow.id);
  const { mutateAsync: disputePeriod, isPending: disputing } = useDisputePeriod();
  const { toast } = useToast();
  const solanaRep = useSolanaReputation();
  const solanaEscrow = useSolanaEscrow();
  const [disputingId, setDisputingId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!periods || periods.length === 0) return null;

  const paidCount = periods.filter((p) => p.status === "paid").length;
  const totalPeriods = escrow.totalPeriods ?? periods.length;
  const progressPct = Math.round((paidCount / totalPeriods) * 100);

  const handleDispute = async (period: PayrollPeriod) => {
    setDisputingId(period.id);
    try {
      await disputePeriod({ escrowId: escrow.id, periodId: period.id });
      // Record dispute on-chain for reputation tracking
      if (solanaRep.isReady && solanaEscrow.walletAddress) {
        try {
          await solanaRep.recordDispute(solanaEscrow.walletAddress, escrow.id);
        } catch (e: any) {
          toast({
            title: "On-chain reputation not updated",
            description: `Period disputed but reputation recording failed: ${e?.message}`,
            variant: "destructive",
          });
        }
      }
      toast({ title: "Period Disputed", description: `Period ${period.periodNumber} is now under dispute.` });
    } catch (err: any) {
      toast({ title: "Dispute Failed", description: err.message, variant: "destructive" });
    } finally {
      setDisputingId(null);
    }
  };

  const canDispute = (period: PayrollPeriod) =>
    isDepositor &&
    (period.status === "active" || period.status === "delivered") &&
    new Date() < new Date(period.disputeDeadline);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Payroll Progress</span>
          <span className="text-xs font-normal text-muted-foreground">
            {paidCount}/{totalPeriods} periods paid
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progressPct} className="h-2" />

        <div className="space-y-2">
          {periods.map((period) => {
            const config = statusConfig[period.status] || statusConfig.pending;
            const Icon = config.icon;
            const isCurrentlyActive = period.status === "active" || period.status === "delivered";

            return (
              <div
                key={period.id}
                className={`flex items-center justify-between p-3 rounded-md text-sm border ${
                  isCurrentlyActive ? "border-primary/20 bg-primary/5" : "border-transparent bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">Period {period.periodNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(period.startsAt).toLocaleDateString()} – {new Date(period.endsAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs">{period.amount} SOL</span>
                  <Badge className={`text-[10px] px-1.5 ${config.color}`}>{config.label}</Badge>
                  {period.payoutTxHash && (
                    <a
                      href={`https://solscan.io/tx/${period.payoutTxHash}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "" : "devnet"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {canDispute(period) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] rounded-full"
                      disabled={disputing && disputingId === period.id}
                      onClick={() => handleDispute(period)}
                    >
                      {disputing && disputingId === period.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Dispute"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
