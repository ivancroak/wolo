"use client";

import { useState } from "react";
import { useAddMilestone, useUpdateMilestone } from "@/hooks/use-escrow";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useAuth } from "@/hooks/use-auth";
import { useVerifyMilestone, type VerificationResult } from "@/hooks/use-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, CheckCircle, XCircle, Target, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ServiceCategory, Escrow, Milestone } from "@shared/schema";

const SOL_DECIMALS = 9;

function solToLamports(sol: string): number {
  const parts = sol.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").padEnd(9, "0").slice(0, 9);
  return Number(BigInt(whole) * BigInt(1_000_000_000) + BigInt(frac));
}

interface MilestonePanelProps {
  escrowId: number;
  escrow: Escrow;
  milestones: Milestone[];
  isDepositor: boolean;
  serviceCategory?: ServiceCategory;
}

const verificationBadge: Record<string, { className: string; label: string }> = {
  verified: { className: "bg-green-500/10 text-green-600", label: "Verified" },
  not_found: { className: "bg-red-500/10 text-red-600", label: "Not Found" },
  manual_only: { className: "bg-yellow-500/10 text-yellow-600", label: "Manual Review" },
  error: { className: "bg-red-500/10 text-red-600", label: "Error" },
};

export function MilestonePanel({ escrowId, escrow, milestones, isDepositor, serviceCategory }: MilestonePanelProps) {
  const { user } = useAuth();
  const { mutate: addMilestone, isPending: adding } = useAddMilestone();
  const { mutate: updateMilestone } = useUpdateMilestone();
  const { mutateAsync: verify, isPending: verifying } = useVerifyMilestone();
  const solanaEscrow = useSolanaEscrow();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [verifyInputs, setVerifyInputs] = useState<Record<number, { tweetUrl: string; targetHandle: string }>>({});
  const [verifyResults, setVerifyResults] = useState<Record<number, VerificationResult>>({});
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const totalMilestoneAmount = milestones.reduce((sum: number, m: Milestone) => sum + parseFloat(m.amount || "0"), 0);
  const completedAmount = milestones
    .filter((m: Milestone) => m.status === "approved")
    .reduce((sum: number, m: Milestone) => sum + parseFloat(m.amount || "0"), 0);

  const handleAdd = async () => {
    if (!title || !amount) return;
    if (!solanaEscrow.isReady) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    try {
      const amountLamports = solToLamports(amount);
      await solanaEscrow.addMilestone(escrow.depositorId, escrowId, title, amountLamports, 0);
      addMilestone({ escrowId, title, amount, description: "" }, {
        onSuccess: () => {
          setTitle("");
          setAmount("");
          setShowForm(false);
          toast({ title: "Milestone Added" });
        },
      });
    } catch (err: any) {
      toast({ title: "Failed to add milestone", description: err?.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (milestone: Milestone, idx: number) => {
    if (!solanaEscrow.isReady) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    try {
      await solanaEscrow.submitMilestone(escrow.depositorId, escrowId, idx);
      updateMilestone({ id: milestone.id, status: "submitted" }, {
        onSuccess: () => toast({ title: "Milestone Submitted" }),
      });
    } catch (err: any) {
      toast({ title: "Failed to submit milestone", description: err?.message, variant: "destructive" });
    }
  };

  const handleReject = async (milestone: Milestone, idx: number) => {
    if (!solanaEscrow.isReady) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    try {
      await solanaEscrow.rejectMilestone(escrow.depositorId, escrowId, idx);
      updateMilestone({ id: milestone.id, status: "rejected" }, {
        onSuccess: () => toast({ title: "Milestone Rejected" }),
      });
    } catch (err: any) {
      toast({ title: "Failed to reject milestone", description: err?.message, variant: "destructive" });
    }
  };

  const handleApprove = async (milestone: Milestone, idx: number) => {
    if (!solanaEscrow.isReady) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    try {
      await solanaEscrow.releaseMilestone(escrowId, escrow.receiverId, idx);
      updateMilestone({ id: milestone.id, status: "approved" }, {
        onSuccess: () => toast({ title: "Milestone Approved" }),
      });
    } catch (err: any) {
      toast({ title: "Failed to approve milestone", description: err?.message, variant: "destructive" });
    }
  };

  const handleVerify = async (milestoneId: number) => {
    const inputs = verifyInputs[milestoneId] ?? { tweetUrl: "", targetHandle: "" };
    setVerifyingId(milestoneId);
    try {
      const result = await verify({
        milestoneId,
        tweetUrl: inputs.tweetUrl || undefined,
        targetHandle: inputs.targetHandle || undefined,
      });
      setVerifyResults((prev) => ({ ...prev, [milestoneId]: result }));
    } catch (err: any) {
      setVerifyResults((prev) => ({
        ...prev,
        [milestoneId]: { status: "error" as const, message: err?.message ?? "Verification failed" },
      }));
    } finally {
      setVerifyingId(null);
    }
  };

  const needsTweetUrl = serviceCategory === "content";
  const needsTargetHandle = false;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600",
    submitted: "bg-blue-500/10 text-blue-600",
    approved: "bg-green-500/10 text-green-600",
    rejected: "bg-red-500/10 text-red-600",
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-3.5 w-3.5" /> Milestones
        </CardTitle>
        {isDepositor && (
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {milestones.length > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Released</span>
              <span>{completedAmount} / {totalMilestoneAmount} SOL</span>
            </div>
            <Progress value={totalMilestoneAmount > 0 ? (completedAmount / totalMilestoneAmount) * 100 : 0} className="h-1.5" />
          </div>
        )}

        {showForm && (
          <div className="flex gap-2 items-end">
            <Input placeholder="Milestone title" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
            <Input type="number" placeholder="SOL" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-sm w-24" />
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </Button>
          </div>
        )}

        {milestones.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No milestones defined</p>
        ) : (
          <div className="space-y-2">
            {milestones.map((m: Milestone, idx: number) => {
              const result = verifyResults[m.id];
              const badge = result ? verificationBadge[result.status] : null;
              const inputs = verifyInputs[m.id] ?? { tweetUrl: "", targetHandle: "" };

              return (
                <div key={m.id} className="p-2 border rounded-md space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{m.amount} SOL</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-[10px] capitalize ${statusColors[m.status] ?? ""}`}>
                        {m.status}
                      </Badge>
                      {m.status === "submitted" && isDepositor && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => handleReject(m, idx)}>
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => handleApprove(m, idx)}>
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                        </div>
                      )}
                      {(m.status === "pending" || m.status === "rejected") && !isDepositor && (
                        <Button size="sm" variant="outline" className="text-xs h-6"
                          onClick={() => handleSubmit(m, idx)}>
                          Submit
                        </Button>
                      )}
                    </div>
                  </div>

                  {m.status === "submitted" && isDepositor && serviceCategory && (
                    <div className="border-t pt-2 space-y-2">
                      <div className="flex gap-2 items-end flex-wrap">
                        {needsTweetUrl && (
                          <Input
                            placeholder="Tweet URL (x.com/...)"
                            value={inputs.tweetUrl}
                            onChange={(e) =>
                              setVerifyInputs((prev) => ({
                                ...prev,
                                [m.id]: { ...inputs, tweetUrl: e.target.value },
                              }))
                            }
                            className="text-xs h-7 flex-1 min-w-[180px]"
                          />
                        )}
                        {needsTargetHandle && (
                          <Input
                            placeholder="Target @handle"
                            value={inputs.targetHandle}
                            onChange={(e) =>
                              setVerifyInputs((prev) => ({
                                ...prev,
                                [m.id]: { ...inputs, targetHandle: e.target.value },
                              }))
                            }
                            className="text-xs h-7 w-40"
                          />
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => handleVerify(m.id)}
                          disabled={verifying && verifyingId === m.id}
                        >
                          {verifying && verifyingId === m.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Search className="h-3 w-3 mr-1" /> Verify
                            </>
                          )}
                        </Button>
                      </div>
                      {result && badge && (
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                          <span className="text-xs text-muted-foreground">{result.message}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
