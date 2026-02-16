"use client";

import { useState } from "react";
import { useAddMilestone, useUpdateMilestone } from "@/hooks/use-escrow";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, CheckCircle, XCircle, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MINT = process.env.NEXT_PUBLIC_SPL_TOKEN_MINT || "";

interface MilestonePanelProps {
  escrowId: number;
  escrow: any;
  milestones: any[];
  isDepositor: boolean;
}

export function MilestonePanel({ escrowId, escrow, milestones, isDepositor }: MilestonePanelProps) {
  const { user } = useAuth();
  const { mutate: addMilestone, isPending: adding } = useAddMilestone();
  const { mutate: updateMilestone } = useUpdateMilestone();
  const solanaEscrow = useSolanaEscrow();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const totalMilestoneAmount = milestones.reduce((sum: number, m: any) => sum + parseFloat(m.amount || "0"), 0);
  const completedAmount = milestones
    .filter((m: any) => m.status === "approved")
    .reduce((sum: number, m: any) => sum + parseFloat(m.amount || "0"), 0);

  const handleAdd = async () => {
    if (!title || !amount) return;
    if (!solanaEscrow.isReady) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    try {
      const amountLamports = Math.round(parseFloat(amount) * 1_000_000);
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

  const handleSubmit = async (milestone: any, idx: number) => {
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

  const handleReject = async (milestone: any, idx: number) => {
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

  const handleApprove = async (milestone: any, idx: number) => {
    if (!solanaEscrow.isReady || !MINT) {
      toast({ title: "Wallet not connected or token not configured", variant: "destructive" });
      return;
    }
    try {
      await solanaEscrow.releaseMilestone(escrowId, escrow.receiverId, MINT, idx);
      updateMilestone({ id: milestone.id, status: "approved" }, {
        onSuccess: () => toast({ title: "Milestone Approved" }),
      });
    } catch (err: any) {
      toast({ title: "Failed to approve milestone", description: err?.message, variant: "destructive" });
    }
  };

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
            {milestones.map((m: any, idx: number) => (
              <div key={m.id} className="flex items-center justify-between gap-2 p-2 border rounded-md">
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
