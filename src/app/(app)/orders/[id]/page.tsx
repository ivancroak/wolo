"use client";

import { useParams, useRouter } from "next/navigation";
import { useEscrowByOrder } from "@/hooks/use-escrow";
import { useUpdateEscrowPhase } from "@/hooks/use-escrow";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useSolanaReputation } from "@/hooks/use-solana-reputation";
import { useAuth } from "@/hooks/use-auth";
import { ChatPanel } from "@/components/ChatPanel";
import { MilestonePanel } from "@/components/MilestonePanel";
import { RatingModal } from "@/components/RatingModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, CheckCircle, XCircle, Star, Shield, Clock, DollarSign, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

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

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orderId = Number(params.id);
  const { toast } = useToast();
  const solanaEscrow = useSolanaEscrow();
  const solanaRep = useSolanaReputation();
  const { mutate: updateEscrowPhase } = useUpdateEscrowPhase();
  const [ratingOpen, setRatingOpen] = useState(false);

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

  const isLoading = orderLoading || escrowLoading;
  const escrow = escrowData?.escrow;
  const milestones = escrowData?.milestones ?? [];

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
        <p className="text-muted-foreground mb-6">This order may not exist or you don't have access.</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const isDepositor = escrow?.depositorId === user?.id;
  const counterpartyId = escrow ? (isDepositor ? escrow.receiverId : escrow.depositorId) : null;

  const handleRelease = async () => {
    if (!escrow) return;
    const mint = process.env.NEXT_PUBLIC_SPL_TOKEN_MINT;
    if (!solanaEscrow.isReady || !mint) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    try {
      const txSig = await solanaEscrow.releaseFunds(escrow.id, escrow.receiverId, mint);
      updateEscrowPhase({ id: escrow.id, phase: "released", txHash: txSig });
      toast({ title: "Funds Released", description: `Tx: ${txSig.slice(0, 16)}...` });
      if (solanaRep.isReady && user) {
        const amountLamports = Math.round(parseFloat(escrow.amount) * 1_000_000);
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
    try {
      await solanaEscrow.advancePhase(escrow.depositorId, escrow.id, "disputed");
      updateEscrowPhase({ id: escrow.id, phase: "disputed" });
      if (solanaRep.isReady && user) {
        try { await solanaRep.recordDispute(user.id, escrow.id); } catch {}
      }
    } catch (err: any) {
      toast({ title: "Transaction failed", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Order #{order.id}</h1>
            <p className="text-sm text-muted-foreground">
              Service #{order.serviceId} &middot; {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
            </p>
          </div>
          <Badge className={`capitalize ${escrow ? phaseColors[escrow.phase] ?? "" : ""}`}>
            {escrow?.phase?.replace(/_/g, " ") ?? order.status}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: Order + Escrow info */}
          <div className="lg:col-span-2 space-y-6">
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
                    <p className="font-mono text-xs">{order.buyerId?.slice(0, 16)}...</p>
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
              </CardContent>
            </Card>

            {escrow && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Escrow Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Amount</span>
                      <p className="text-lg font-bold font-mono">{escrow.amount} <span className="text-xs text-muted-foreground">SOL</span></p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Depositor</span>
                      <p className="font-mono text-xs">{escrow.depositorId?.slice(0, 16)}...</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Receiver</span>
                      <p className="font-mono text-xs">{escrow.receiverId?.slice(0, 16)}...</p>
                    </div>
                  </div>
                  {escrow.expiresAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Expires {new Date(escrow.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                  {escrow.depositTxHash && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Deposit Tx: </span>
                      <span className="font-mono break-all">{escrow.depositTxHash}</span>
                    </div>
                  )}
                  {escrow.releaseTxHash && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Release Tx: </span>
                      <span className="font-mono break-all">{escrow.releaseTxHash}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap pt-2 border-t">
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
                          try {
                            await solanaEscrow.advancePhase(escrow.depositorId, escrow.id, "in_progress");
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
                          try {
                            await solanaEscrow.advancePhase(escrow.depositorId, escrow.id, "under_review");
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
                    {escrow.phase === "disputed" && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <AlertTriangle className="h-4 w-4" /> Disputed
                        </div>
                        {isDepositor && (
                          <Button size="sm" variant="outline" className="rounded-full"
                            onClick={async () => {
                              const mint = process.env.NEXT_PUBLIC_SPL_TOKEN_MINT;
                              if (!solanaEscrow.isReady || !mint) {
                                toast({ title: "Wallet not connected", variant: "destructive" });
                                return;
                              }
                              try {
                                const txSig = await solanaEscrow.refund(escrow.depositorId, escrow.id, mint);
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
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {escrow && (
              <MilestonePanel
                escrowId={escrow.id}
                escrow={escrow}
                milestones={milestones}
                isDepositor={isDepositor}
              />
            )}
          </div>

          {/* Right column: Chat */}
          <div className="space-y-6">
            {escrow && counterpartyId && (
              <ChatPanel orderId={orderId} recipientId={counterpartyId} />
            )}
          </div>
        </div>
      </motion.div>

      {escrow && counterpartyId && (
        <RatingModal
          orderId={orderId}
          escrowId={escrow.id}
          targetId={counterpartyId}
          open={ratingOpen}
          onOpenChange={setRatingOpen}
        />
      )}
    </div>
  );
}
