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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type MilestoneType = "post_tweets" | "retweet" | "follow";

const MILESTONE_TYPES: { value: MilestoneType; label: string; description: string }[] = [
  { value: "post_tweets", label: "Post Tweets", description: "Post tweets containing a keyword" },
  { value: "retweet", label: "Retweet", description: "Retweet a specific tweet" },
  { value: "follow", label: "Follow Account", description: "Follow a specific X account" },
];

interface MilestoneParams {
  type: MilestoneType;
  keyword?: string;
  postCount?: number;
  tweetUrl?: string;
  targetHandle?: string;
}

function buildMilestoneTitle(params: MilestoneParams): string {
  switch (params.type) {
    case "post_tweets":
      return `Post ${params.postCount || 1} tweet${(params.postCount || 1) > 1 ? "s" : ""} with "${params.keyword}"`;
    case "retweet":
      return `Retweet ${params.tweetUrl || "tweet"}`;
    case "follow":
      return `Follow @${(params.targetHandle || "").replace(/^@/, "")}`;
  }
}

function parseMilestoneParams(description: string): MilestoneParams | null {
  try {
    const parsed = JSON.parse(description);
    if (parsed && parsed.type) return parsed as MilestoneParams;
  } catch {}
  return null;
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
  insufficient: { className: "bg-yellow-500/10 text-yellow-600", label: "Insufficient" },
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

  // Form state
  const [milestoneType, setMilestoneType] = useState<MilestoneType | "">("");
  const [keyword, setKeyword] = useState("");
  const [postCount, setPostCount] = useState("1");
  const [tweetUrl, setTweetUrl] = useState("");
  const [targetHandle, setTargetHandle] = useState("");
  const [amount, setAmount] = useState("");

  const [verifyResults, setVerifyResults] = useState<Record<number, VerificationResult>>({});
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const totalMilestoneAmount = milestones.reduce((sum: number, m: Milestone) => sum + parseFloat(m.amount || "0"), 0);
  const completedAmount = milestones
    .filter((m: Milestone) => m.status === "approved")
    .reduce((sum: number, m: Milestone) => sum + parseFloat(m.amount || "0"), 0);

  const resetForm = () => {
    setMilestoneType("");
    setKeyword("");
    setPostCount("1");
    setTweetUrl("");
    setTargetHandle("");
    setAmount("");
    setShowForm(false);
  };

  const isFormValid = (): boolean => {
    if (!milestoneType || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return false;
    switch (milestoneType) {
      case "post_tweets":
        return keyword.trim().length > 0 && parseInt(postCount) > 0;
      case "retweet":
        return tweetUrl.trim().length > 0;
      case "follow":
        return targetHandle.trim().length > 0;
    }
    return false;
  };

  const handleAdd = async () => {
    if (!isFormValid() || !milestoneType) return;
    if (!solanaEscrow.isReady) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    if (!escrow.depositorWalletAddress) {
      toast({ title: "Depositor wallet address missing", variant: "destructive" });
      return;
    }

    const params: MilestoneParams = { type: milestoneType };
    switch (milestoneType) {
      case "post_tweets":
        params.keyword = keyword.trim();
        params.postCount = parseInt(postCount);
        break;
      case "retweet":
        params.tweetUrl = tweetUrl.trim();
        break;
      case "follow":
        params.targetHandle = targetHandle.trim().replace(/^@/, "");
        break;
    }

    const title = buildMilestoneTitle(params);
    const description = JSON.stringify(params);

    try {
      const amountLamports = solToLamports(amount);
      await solanaEscrow.addMilestone(escrow.depositorWalletAddress!, escrowId, title, amountLamports, 0);
      addMilestone({ escrowId, title, amount, description }, {
        onSuccess: () => {
          resetForm();
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
    if (!escrow.depositorWalletAddress) {
      toast({ title: "Depositor wallet address missing", variant: "destructive" });
      return;
    }
    try {
      await solanaEscrow.submitMilestone(escrow.depositorWalletAddress!, escrowId, idx);
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
    if (!escrow.depositorWalletAddress) {
      toast({ title: "Depositor wallet address missing", variant: "destructive" });
      return;
    }
    try {
      await solanaEscrow.rejectMilestone(escrow.depositorWalletAddress!, escrowId, idx);
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

  const handleVerify = async (milestone: Milestone) => {
    const params = parseMilestoneParams(milestone.description);
    setVerifyingId(milestone.id);
    try {
      const result = await verify({
        milestoneId: milestone.id,
        tweetUrl: params?.tweetUrl || undefined,
        targetHandle: params?.targetHandle || undefined,
      });
      setVerifyResults((prev) => ({ ...prev, [milestone.id]: result }));
    } catch (err: any) {
      setVerifyResults((prev) => ({
        ...prev,
        [milestone.id]: { status: "error" as const, message: err?.message ?? "Verification failed" },
      }));
    } finally {
      setVerifyingId(null);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600",
    submitted: "bg-blue-500/10 text-blue-600",
    approved: "bg-green-500/10 text-green-600",
    rejected: "bg-red-500/10 text-red-600",
  };

  const typeLabels: Record<string, string> = {
    post_tweets: "Post Tweets",
    retweet: "Retweet",
    follow: "Follow",
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
          <div className="space-y-2 p-3 border rounded-md bg-muted/30">
            <Select value={milestoneType} onValueChange={(v) => setMilestoneType(v as MilestoneType)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select milestone type" />
              </SelectTrigger>
              <SelectContent>
                {MILESTONE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <span className="font-medium">{t.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {milestoneType === "post_tweets" && (
              <div className="flex gap-2">
                <Input
                  placeholder="Keyword (e.g. #wolo)"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="text-sm flex-1"
                />
                <Select value={postCount} onValueChange={setPostCount}>
                  <SelectTrigger className="text-sm w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 10, 15, 20, 30, 50].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} post{n > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {milestoneType === "retweet" && (
              <Input
                placeholder="Tweet URL (e.g. x.com/user/status/123)"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                className="text-sm"
              />
            )}

            {milestoneType === "follow" && (
              <Input
                placeholder="Target handle (e.g. @elonmusk)"
                value={targetHandle}
                onChange={(e) => setTargetHandle(e.target.value)}
                className="text-sm"
              />
            )}

            {milestoneType && (
              <div className="flex gap-2 items-end">
                <Input
                  type="number"
                  placeholder="SOL amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-sm w-32"
                  step="0.01"
                  min="0"
                />
                <Button size="sm" onClick={handleAdd} disabled={adding || !isFormValid()}>
                  {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {milestones.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No milestones defined</p>
        ) : (
          <div className="space-y-2">
            {milestones.map((m: Milestone, idx: number) => {
              const result = verifyResults[m.id];
              const badge = result ? verificationBadge[result.status] : null;
              const params = parseMilestoneParams(m.description);

              return (
                <div key={m.id} className="p-2 border rounded-md space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {params && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {typeLabels[params.type] || params.type}
                          </Badge>
                        )}
                        <p className="text-sm font-medium truncate">{m.title}</p>
                      </div>
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

                  {m.status === "submitted" && isDepositor && (
                    <div className="border-t pt-2 space-y-2">
                      <div className="flex gap-2 items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => handleVerify(m)}
                          disabled={verifying && verifyingId === m.id}
                        >
                          {verifying && verifyingId === m.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Search className="h-3 w-3 mr-1" /> Auto-Verify
                            </>
                          )}
                        </Button>
                        {params && (
                          <span className="text-[10px] text-muted-foreground">
                            {params.type === "post_tweets" && `Checks tweets for "${params.keyword}"`}
                            {params.type === "retweet" && "Checks retweeters list"}
                            {params.type === "follow" && `Checks if following @${params.targetHandle}`}
                          </span>
                        )}
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
