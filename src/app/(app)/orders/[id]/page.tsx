"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEscrowByOrder } from "@/hooks/use-escrow";
import { useUpdateEscrowPhase } from "@/hooks/use-escrow";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useSolanaReputation } from "@/hooks/use-solana-reputation";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateOrder } from "@/hooks/use-orders";
import { ChatPanel } from "@/components/ChatPanel";
import { MilestonePanel } from "@/components/MilestonePanel";
import { PayrollTimeline } from "@/components/PayrollTimeline";
import { RatingModal } from "@/components/RatingModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, CheckCircle, XCircle, Star, Shield, Clock, AlertTriangle, FileText, Briefcase, CalendarClock, ShieldCheck, Image } from "lucide-react";
import { ProposeChangesModal } from "@/components/ProposeChangesModal";
import { useDealProposals } from "@/hooks/use-deal-proposals";
import type { DealProposal } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const phaseColors: Record<string, string> = {
  awaiting_deposit: "bg-yellow-500/10 text-yellow-600",
  funded: "bg-blue-500/10 text-blue-600",
  in_progress: "bg-indigo-500/10 text-indigo-600",
  under_review: "bg-purple-500/10 text-purple-600",
  milestone_check: "bg-cyan-500/10 text-cyan-600",
  released: "bg-green-500/10 text-green-600",
  refunded: "bg-gray-500/10 text-gray-600",
  disputed: "bg-red-500/10 text-red-600",
};

const pricingLabels: Record<string, string> = {
  fixed: "Fixed Price",
  payroll: "Payroll",
};

function DealTermsCard({ order, service }: { order: any; service: any }) {
  const rows: { label: string; value: string; negotiated: boolean }[] = [];

  const addRow = (label: string, negotiatedVal: any, serviceVal: any, suffix = "") => {
    const isNegotiated = negotiatedVal != null;
    const val = negotiatedVal ?? serviceVal;
    if (val != null) {
      rows.push({ label, value: `${val}${suffix}`, negotiated: isNegotiated });
    }
  };

  addRow("Price", order.negotiatedPrice, service.price, " SOL");
  addRow("Deadline", order.negotiatedDeadlineDays, service.deadlineDays, " days");
  addRow("Min Posts", order.negotiatedMinPostCount, service.minPostCount);
  addRow("Posts / Period", order.negotiatedPostsPerPeriod, service.postsPerPeriod);
  addRow("Threads / Period", order.negotiatedThreadsPerPeriod, service.threadsPerPeriod);
  addRow("Content Type", order.negotiatedContentType, service.contentType);
  addRow("Keyword", order.negotiatedRequiredKeyword, order.requiredKeyword ?? service.requiredKeyword);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" /> Deal Terms
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="flex items-center gap-1.5 font-medium">
              {row.value}
              {row.negotiated && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/50 text-amber-600">
                  Negotiated
                </Badge>
              )}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ServiceDetailsCard({ service }: { service: any }) {
  if (!service) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Image className="h-3.5 w-3.5" /> Service Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Description</span>
          <p className="text-sm mt-1 whitespace-pre-wrap">{service.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {service.pricingCategory && (
            <div className="space-y-0.5">
              <span className="text-muted-foreground uppercase tracking-wider">Pricing</span>
              <p className="font-medium flex items-center gap-1">
                {service.pricingCategory === "payroll" ? <CalendarClock className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                {pricingLabels[service.pricingCategory] ?? service.pricingCategory}
                {service.payrollBasis ? ` / ${service.payrollBasis}` : ""}
              </p>
            </div>
          )}
          {service.contentType && (
            <div className="space-y-0.5">
              <span className="text-muted-foreground uppercase tracking-wider">Content Type</span>
              <p className="font-medium capitalize">{service.contentType === "mixed" ? "Posts + Threads" : service.contentType}</p>
            </div>
          )}
          {service.requiredKeyword && (
            <div className="space-y-0.5">
              <span className="text-muted-foreground uppercase tracking-wider">Keyword</span>
              <p className="font-medium font-mono flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> {service.requiredKeyword}
              </p>
            </div>
          )}
          {service.minPostCount && (
            <div className="space-y-0.5">
              <span className="text-muted-foreground uppercase tracking-wider">Min Posts</span>
              <p className="font-medium">{service.minPostCount}</p>
            </div>
          )}
          {service.postsPerPeriod && (
            <div className="space-y-0.5">
              <span className="text-muted-foreground uppercase tracking-wider">Posts/Period</span>
              <p className="font-medium">{service.postsPerPeriod}</p>
            </div>
          )}
          {service.deadlineDays && (
            <div className="space-y-0.5">
              <span className="text-muted-foreground uppercase tracking-wider">Deadline</span>
              <p className="font-medium">{service.deadlineDays} day{service.deadlineDays !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
        {service.imageUrl && (
          <div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Reference URL</span>
            <a href={service.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all block mt-0.5">
              {service.imageUrl}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const orderId = Number(params.id);
  const { toast } = useToast();
  const solanaEscrow = useSolanaEscrow();
  const solanaRep = useSolanaReputation();
  const { mutate: updateEscrowPhase } = useUpdateEscrowPhase();
  const { mutate: updateOrder } = useUpdateOrder();
  const { data: proposals } = useDealProposals(orderId);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [fundingInProgress, setFundingInProgress] = useState(false);

  // Auto-open propose modal when navigated with ?propose=1
  useEffect(() => {
    if (searchParams.get("propose") === "1" && !proposeOpen) {
      setProposeOpen(true);
    }
  }, [searchParams, proposeOpen]);

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["/api/orders", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!orderId,
  });

  const { data: escrowData, isLoading: escrowLoading } = useEscrowByOrder(orderId);

  const { data: service } = useQuery({
    queryKey: ["/api/services", order?.serviceId],
    queryFn: async () => {
      const res = await fetch(`/api/services/${order.serviceId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!order?.serviceId,
  });

  const isLoading = orderLoading || escrowLoading;
  const escrow = escrowData?.escrow;
  const milestones = escrowData?.milestones ?? [];
  const hasPendingProposal = (proposals ?? []).some((p: DealProposal) => p.status === "pending");
  const orderClosed = order?.status === "completed" || order?.status === "cancelled";

  const isBuyer = order?.buyerId === user?.id;
  const isSeller = service?.creatorId === user?.id;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <h2 className="text-xl font-bold mb-2">Order not found</h2>
        <p className="text-muted-foreground mb-6">This order may not exist or you don&apos;t have access.</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const isDepositor = escrow?.depositorId === user?.id;
  const counterpartyId = escrow ? (isDepositor ? escrow.receiverId : escrow.depositorId) : null;

  // Display names: prefer X handle, fallback to truncated wallet
  const buyerDisplay = order.buyerTwitterHandle
    ? `@${order.buyerTwitterHandle}`
    : (order.buyerId?.slice(0, 16) + "...");
  const sellerDisplay = order.sellerTwitterHandle
    ? `@${order.sellerTwitterHandle}`
    : (service?.creatorTwitterHandle ? `@${service.creatorTwitterHandle}` : (service?.creatorId?.slice(0, 16) + "..."));

  const handleRelease = async () => {
    if (!escrow) return;
    if (!solanaEscrow.isReady) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    if (!escrow.receiverWalletAddress) {
      toast({ title: "Receiver wallet address missing", variant: "destructive" });
      return;
    }
    try {
      const txSig = await solanaEscrow.releaseFunds(escrow.id, escrow.receiverWalletAddress);
      updateEscrowPhase({ id: escrow.id, phase: "released", txHash: txSig });
      toast({ title: "Funds Released", description: `Tx: ${txSig.slice(0, 16)}...` });
      if (solanaRep.isReady && user) {
        const amountLamports = Math.round(parseFloat(escrow.amount) * 1_000_000_000);
        try { await solanaRep.recordCompletion(user.id, escrow.id, amountLamports, isDepositor ?? true); } catch {}
      }
    } catch (err: any) {
      toast({ title: "Release Failed", description: err?.message, variant: "destructive" });
    }
  };

  const handleDispute = async () => {
    if (!escrow) return;
    if (!solanaEscrow.isReady) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    if (!escrow.depositorWalletAddress) {
      toast({ title: "Depositor wallet address missing", variant: "destructive" });
      return;
    }
    try {
      await solanaEscrow.advancePhase(escrow.depositorWalletAddress, escrow.id, "disputed");
      updateEscrowPhase({ id: escrow.id, phase: "disputed" });
      if (solanaRep.isReady && user) {
        try { await solanaRep.recordDispute(user.id, escrow.id); } catch {}
      }
    } catch (err: any) {
      toast({ title: "Transaction failed", description: err?.message, variant: "destructive" });
    }
  };

  const handleCancelOrder = () => {
    updateOrder({ id: orderId, status: "cancelled" }, {
      onSuccess: () => {
        toast({ title: "Order Cancelled", description: "This order has been cancelled." });
        router.push("/dashboard");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to cancel order.", variant: "destructive" });
      },
    });
  };

  const handleFundEscrow = async () => {
    if (!escrow) return;
    if (!solanaEscrow.isReady) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    if (!escrow.receiverWalletAddress) {
      toast({ title: "Receiver wallet address missing", description: "The seller must set their wallet in Profile first.", variant: "destructive" });
      return;
    }
    setFundingInProgress(true);
    try {
      // Convert SOL string to lamports
      const parts = escrow.amount.split(".");
      const whole = parts[0] || "0";
      const frac = (parts[1] || "").padEnd(9, "0").slice(0, 9);
      const amountLamports = Number(BigInt(whole) * BigInt(1_000_000_000) + BigInt(frac));

      const expiresInDays = escrow.expiresAt
        ? Math.max(1, Math.ceil((new Date(escrow.expiresAt).getTime() - Date.now()) / 86400000))
        : 7;

      const txSig = await solanaEscrow.initializeAndFund(
        escrow.receiverWalletAddress,
        escrow.id,
        amountLamports,
        expiresInDays,
      );
      updateEscrowPhase({ id: escrow.id, phase: "funded", txHash: txSig });
      toast({ title: "Payment Locked On-Chain", description: `Tx: ${txSig.slice(0, 16)}...` });
    } catch (err: any) {
      toast({ title: "Funding failed", description: err?.message || "On-chain transaction failed.", variant: "destructive" });
    } finally {
      setFundingInProgress(false);
    }
  };

  const serviceTitle = order.serviceTitle ?? service?.title ?? `Service #${order.serviceId}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{serviceTitle}</h1>
            <p className="text-sm text-muted-foreground">
              Order #{order.id} &middot; {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
            </p>
          </div>
          <Badge className={`capitalize ${escrow ? phaseColors[escrow.phase] ?? "" : ""}`}>
            {escrow?.phase?.replace(/_/g, " ") ?? order.status}
          </Badge>
        </div>

        {/* Two-column layout: left = order info, right = deal terms + service details */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left column: Order + Payment + Payroll/Milestones (3/5 width) */}
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Status</span>
                    <p className="font-medium capitalize">{order.status}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Buyer</span>
                    <p className="text-sm font-medium">{buyerDisplay}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Seller</span>
                    <p className="text-sm font-medium">{sellerDisplay}</p>
                  </div>
                </div>
                {order.requirements && (
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Requirements</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{order.requirements}</p>
                  </div>
                )}
                {order.txHash && (
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Tx Hash</span>
                    <p className="font-mono text-xs break-all">{order.txHash}</p>
                  </div>
                )}

                {/* Buyer actions: propose changes + cancel + pay */}
                {isBuyer && !orderClosed && (
                  <div className="flex gap-2 flex-wrap pt-2 border-t">
                    {!hasPendingProposal && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setProposeOpen(true)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Propose Changes
                      </Button>
                    )}
                    {(!escrow || escrow.phase === "awaiting_deposit") && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10">
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            Cancel Order
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Cancel this order?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will cancel the order permanently.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Order</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={handleCancelOrder}
                            >
                              Cancel Order
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}

                {/* Seller actions: propose changes */}
                {isSeller && !orderClosed && !hasPendingProposal && (
                  <div className="flex gap-2 flex-wrap pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setProposeOpen(true)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      Propose Changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {escrow && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Payment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Amount</span>
                      <p className="text-lg font-bold font-mono">{escrow.amount} <span className="text-xs text-muted-foreground">SOL</span></p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Buyer</span>
                      <p className="text-sm font-medium">{buyerDisplay}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Seller</span>
                      <p className="text-sm font-medium">{sellerDisplay}</p>
                    </div>
                  </div>
                  {escrow.expiresAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Expires {new Date(escrow.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                  {escrow.releaseTxHash && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Release Tx: </span>
                      <span className="font-mono break-all">{escrow.releaseTxHash}</span>
                    </div>
                  )}
                  {order.negotiatedPrice && order.negotiatedPrice !== escrow.amount && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-md px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Locked amount ({escrow.amount} SOL) doesn&apos;t match deal price ({order.negotiatedPrice} SOL). Buyer needs to adjust funds.
                    </div>
                  )}

                  {escrow.phase === "awaiting_deposit" && isDepositor && (
                    <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-500/10 rounded-md px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Payment not yet funded. Click &quot;Pay for Order&quot; below to lock funds on-chain.
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap pt-2 border-t">
                    {escrow.phase === "awaiting_deposit" && isDepositor && (
                      <Button size="sm" className="rounded-full" onClick={handleFundEscrow} disabled={fundingInProgress}>
                        {fundingInProgress ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Shield className="mr-1 h-3 w-3" />}
                        Pay for Order
                      </Button>
                    )}
                    {escrow.phase === "under_review" && isDepositor && (
                      <>
                        <Button size="sm" className="rounded-full" onClick={handleRelease}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Approve & Release
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={handleDispute}>
                          <XCircle className="mr-1 h-3 w-3" /> Dispute
                        </Button>
                      </>
                    )}
                    {escrow.phase === "funded" && !isDepositor && (
                      <Button size="sm" variant="outline" className="rounded-full"
                        onClick={async () => {
                          if (!solanaEscrow.isReady) {
                            toast({ title: "Wallet not connected", variant: "destructive" });
                            return;
                          }
                          if (!escrow.depositorWalletAddress) {
                            toast({ title: "Depositor wallet address missing", variant: "destructive" });
                            return;
                          }
                          try {
                            await solanaEscrow.advancePhase(escrow.depositorWalletAddress, escrow.id, "in_progress");
                            updateEscrowPhase({ id: escrow.id, phase: "in_progress" });
                          } catch (err: any) {
                            toast({ title: "Transaction failed", description: err?.message, variant: "destructive" });
                          }
                        }}>
                        Start Work
                      </Button>
                    )}
                    {escrow.phase === "in_progress" && !isDepositor && (
                      <Button size="sm" className="rounded-full"
                        onClick={async () => {
                          if (!solanaEscrow.isReady) {
                            toast({ title: "Wallet not connected", variant: "destructive" });
                            return;
                          }
                          if (!escrow.depositorWalletAddress) {
                            toast({ title: "Depositor wallet address missing", variant: "destructive" });
                            return;
                          }
                          try {
                            await solanaEscrow.advancePhase(escrow.depositorWalletAddress, escrow.id, "under_review");
                            updateEscrowPhase({ id: escrow.id, phase: "under_review" });
                          } catch (err: any) {
                            toast({ title: "Transaction failed", description: err?.message, variant: "destructive" });
                          }
                        }}>
                        Submit for Review
                      </Button>
                    )}
                    {escrow.phase === "released" && (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setRatingOpen(true)}>
                        <Star className="mr-1 h-3 w-3" /> Rate Transaction
                      </Button>
                    )}
                    {escrow.phase === "disputed" && (() => {
                      const disputeOpenedAt = escrow.disputeOpenedAt;
                      const canRefund = disputeOpenedAt && Date.now() / 1000 > new Date(disputeOpenedAt).getTime() / 1000 + 7 * 86400;
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4" /> Disputed
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {canRefund
                              ? "Dispute window expired. You may claim a refund."
                              : "Seller has 7 days to submit evidence. After that, you may claim a refund."}
                          </p>
                          {isDepositor && (
                            <Button size="sm" variant="outline" className="rounded-full"
                              disabled={!canRefund}
                              onClick={async () => {
                                if (!solanaEscrow.isReady) {
                                  toast({ title: "Wallet not connected", variant: "destructive" });
                                  return;
                                }
                                if (!escrow.depositorWalletAddress) {
                                  toast({ title: "Depositor wallet address missing", variant: "destructive" });
                                  return;
                                }
                                try {
                                  const txSig = await solanaEscrow.refund(escrow.depositorWalletAddress, escrow.id);
                                  updateEscrowPhase({ id: escrow.id, phase: "refunded", txHash: txSig });
                                  toast({ title: "Refund Processed", description: `Tx: ${txSig.slice(0, 12)}...` });
                                } catch (err: any) {
                                  toast({ title: "On-chain refund failed", description: err?.message, variant: "destructive" });
                                }
                              }}>
                              Claim Refund
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {escrow && escrow.isRecurring ? (
              <PayrollTimeline escrow={escrow} isDepositor={isDepositor ?? false} />
            ) : escrow ? (
              <MilestonePanel
                escrowId={escrow.id}
                escrow={escrow}
                milestones={milestones}
                isDepositor={isDepositor}
                serviceCategory={service?.category}
              />
            ) : null}
          </div>

          {/* Right column: Deal Terms + Service Details (2/5 width) */}
          <div className="lg:col-span-2 space-y-6">
            {service && order && (
              <DealTermsCard order={order} service={service} />
            )}
            {service && (
              <ServiceDetailsCard service={service} />
            )}
          </div>
        </div>

        {/* Full-width Chat section */}
        {escrow && counterpartyId && (
          <div className="mt-6">
            <ChatPanel
              orderId={orderId}
              recipientId={counterpartyId}
              service={service}
              order={order}
              escrowPhase={escrow.phase}
            />
          </div>
        )}
      </motion.div>

      {escrow && counterpartyId && (
        <RatingModal
          orderId={orderId}
          escrowId={escrow.id}
          targetId={counterpartyId}
          depositorId={escrow.depositorId}
          open={ratingOpen}
          onOpenChange={setRatingOpen}
        />
      )}
      {service && order && (
        <ProposeChangesModal
          open={proposeOpen}
          onOpenChange={setProposeOpen}
          order={order}
          service={service}
          escrowPhase={escrow?.phase}
        />
      )}
    </div>
  );
}
