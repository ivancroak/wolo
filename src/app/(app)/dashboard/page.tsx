"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyOrders, useMySales, useUpdateOrder } from "@/hooks/use-orders";
import { useMyServices } from "@/hooks/use-services";
import { useMyEscrows, useUpdateEscrowPhase, useDisputeResolve } from "@/hooks/use-escrow";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useSolanaReputation } from "@/hooks/use-solana-reputation";
import { useMyReputation } from "@/hooks/use-reputation";
import { useVerifyContract } from "@/hooks/use-verification";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Package, TrendingUp, CheckCircle, XCircle, LayoutList, Shield, Star, Award, AlertTriangle, Send, MessageSquare, ArrowLeft, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useNotifications, useMarkRead } from "@/hooks/use-notifications";
import { useMyConversations, type Conversation } from "@/hooks/use-conversations";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { motion, AnimatePresence } from "framer-motion";
import { ChatPanel } from "@/components/ChatPanel";
import { MilestonePanel } from "@/components/MilestonePanel";
import { RatingModal } from "@/components/RatingModal";
import { type Order, type Service, type Escrow } from "@shared/schema";

function solToLamports(sol: string): number {
  const [whole = "0", frac = ""] = sol.split(".");
  const paddedFrac = (frac + "000000000").slice(0, 9);
  return Number(BigInt(whole) * BigInt(1_000_000_000) + BigInt(paddedFrac));
}

export default function DashboardPage() {
  const { user, isLoading: authLoading, isLoggingIn } = useAuth();
  const { data: orders, isLoading: ordersLoading } = useMyOrders();
  const { data: sales, isLoading: salesLoading } = useMySales();
  const { data: myServices, isLoading: servicesLoading } = useMyServices();
  const { data: myEscrows, isLoading: escrowsLoading } = useMyEscrows();
  const { data: reputation } = useMyReputation();
  const { mutate: updateOrder } = useUpdateOrder();
  const { mutate: updateEscrowPhase } = useUpdateEscrowPhase();
  const { mutate: disputeResolve, isPending: isDisputeResolving } = useDisputeResolve();
  const { mutate: verifyContract, isPending: isVerifying } = useVerifyContract();
  const solanaEscrow = useSolanaEscrow();
  const solanaRep = useSolanaReputation();
  const { toast } = useToast();
  const { data: conversations, isLoading: convsLoading } = useMyConversations();
  const { data: notifications } = useNotifications();
  const { mutate: markRead } = useMarkRead();
  const [ratingTarget, setRatingTarget] = useState<{ orderId: number; escrowId?: number; targetId: string; depositorId?: string } | null>(null);
  const [loadingEscrowId, setLoadingEscrowId] = useState<number | null>(null);
  const [openChat, setOpenChat] = useState<number | null>(null);

  const unreadByOrderId = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const n of notifications ?? []) {
      if (n.type !== "message_received" || n.read) continue;
      const match = n.linkUrl?.match(/\/orders\/(\d+)/);
      if (!match) continue;
      const orderId = Number(match[1]);
      const arr = map.get(orderId) ?? [];
      arr.push(n.id);
      map.set(orderId, arr);
    }
    return map;
  }, [notifications]);

  const unreadMessageCount = useMemo(() => {
    let count = 0;
    unreadByOrderId.forEach((ids) => { count += ids.length; });
    return count;
  }, [unreadByOrderId]);

  useEffect(() => {
    if (openChat === null) return;
    const ids = unreadByOrderId.get(openChat);
    if (ids?.length) markRead(ids);
  }, [openChat, unreadByOrderId, markRead]);

  const handleStatusUpdate = (orderId: number, status: "completed" | "cancelled") => {
    updateOrder({ id: orderId, status }, {
      onSuccess: () => {
        toast({ title: "Order Updated", description: `Order marked as ${status}.` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update order.", variant: "destructive" });
      }
    });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const variant = status === "completed" ? "default" : status === "cancelled" ? "destructive" : "secondary";
    return <Badge variant={variant === "default" ? "default" : variant === "destructive" ? "destructive" : "secondary"} className="text-xs capitalize" data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  if (authLoading || isLoggingIn) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <LayoutList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2">Connect wallet to view Dashboard</h2>
          <p className="text-muted-foreground text-sm mb-6">Manage your orders, services, and escrows.</p>
          <ConnectWallet />
        </div>
      </div>
    );
  }

  const OrderCard = ({ order, isSeller }: { order: Order; isSeller?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card data-testid={`card-order-${order.id}`}>
        <CardHeader className="pb-2 flex-row items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">Order #{order.id}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {order.createdAt ? format(new Date(order.createdAt), "PPP") : ""}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </CardHeader>
        <CardContent className="space-y-3">
          {order.requirements && (
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="font-medium mb-1 text-muted-foreground text-xs uppercase tracking-wider">Requirements</p>
              <p className="text-foreground">{order.requirements}</p>
            </div>
          )}
          <div className="flex justify-between items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <Link href={`/orders/${order.id}`} className="font-mono text-xs hover:underline">
              Order #{order.id} &middot; Service #{order.serviceId}
            </Link>
            {isSeller && order.status === "pending" && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => handleStatusUpdate(order.id, "cancelled")}
                  data-testid={`button-cancel-${order.id}`}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => handleStatusUpdate(order.id, "completed")}
                  data-testid={`button-complete-${order.id}`}
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Complete
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="px-6 py-6">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-black tracking-tighter mb-8"
        data-testid="text-dashboard-title"
      >
        Dashboard
      </motion.h1>

      {reputation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Star className="mx-auto h-5 w-5 text-amber-500 mb-1" />
              <p className="text-2xl font-bold font-mono">{reputation.avgRating?.toFixed(1) ?? "--"}</p>
              <p className="text-xs text-muted-foreground">Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <CheckCircle className="mx-auto h-5 w-5 text-green-500 mb-1" />
              <p className="text-2xl font-bold font-mono">{reputation.ordersCompleted}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Shield className="mx-auto h-5 w-5 text-blue-500 mb-1" />
              <p className="text-2xl font-bold font-mono">{myEscrows?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Escrows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Award className="mx-auto h-5 w-5 text-purple-500 mb-1" />
              <div className="flex gap-1 justify-center flex-wrap mt-1">
                {reputation.badges?.length > 0 ? reputation.badges.map((b: string) => (
                  <Badge key={b} variant="secondary" className="text-[10px]">{b.replace(/_/g, " ")}</Badge>
                )) : <span className="text-xs text-muted-foreground">None yet</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Badges</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="listings" className="w-full">
        <TabsList className="mb-8 w-full max-w-2xl grid grid-cols-5">
          <TabsTrigger value="listings" data-testid="tab-listings">Listings</TabsTrigger>
          <TabsTrigger value="escrows" data-testid="tab-escrows">Escrows</TabsTrigger>
          <TabsTrigger value="buying" data-testid="tab-buying">Buying</TabsTrigger>
          <TabsTrigger value="selling" data-testid="tab-selling">Selling</TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-chat" className="relative" onClick={() => setOpenChat(null)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Chat
            {unreadMessageCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadMessageCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings">
          {servicesLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : !myServices?.length ? (
            <div className="text-center py-20 border border-dashed rounded-md" data-testid="text-no-listings">
              <LayoutList className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold mb-2">No listings yet</h3>
              <p className="text-muted-foreground text-sm">Head to the marketplace to list a service or post a request.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence>
                {myServices.map((service: Service) => {
                  const pct = service.maxActions ? Math.round((service.actionsCompleted / service.maxActions) * 100) : 0;
                  return (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card data-testid={`card-listing-${service.id}`}>
                        <CardHeader className="pb-2 flex-row items-start justify-between gap-2 flex-wrap">
                          <div>
                            <CardTitle className="text-base">{service.title}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                              {service.createdAt ? format(new Date(service.createdAt), "PPP") : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className="text-[10px] capitalize gap-1"
                            >
                              {service.listingType === "request" ? "Request" : "Offer"} &middot; {service.category}
                            </Badge>
                            <span className={`h-2 w-2 rounded-full ${service.active ? "bg-green-500" : "bg-red-400"}`} title={service.active ? "Active" : "Inactive"} />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{service.description}</p>
                          <p className="text-lg font-bold font-mono">{service.price} <span className="text-xs text-muted-foreground font-sans">SOL</span></p>
                          {service.maxActions && (
                            <div className="space-y-1 pt-2 border-t border-border/50 mt-2">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Contracts</span>
                                <span>{service.actionsCompleted} / {service.maxActions} ({pct}%)</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          )}
                          <Link href={`/services/${service.id}`} className="inline-block text-xs text-muted-foreground hover:text-foreground hover:underline mt-2">
                            View Details &rarr;
                          </Link>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="escrows">
          {escrowsLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : !myEscrows?.length ? (
            <div className="text-center py-20 border border-dashed rounded-md" data-testid="text-no-escrows">
              <Shield className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold mb-2">No escrows yet</h3>
              <p className="text-muted-foreground text-sm">Escrows are created automatically when you purchase or fulfill a service.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence>
                {myEscrows.map((escrow: Escrow & { milestones?: any[] }) => {
                  const phaseColors: Record<string, string> = {
                    awaiting_deposit: "bg-yellow-500/10 text-yellow-600",
                    funded: "bg-blue-500/10 text-blue-600",
                    in_progress: "bg-indigo-500/10 text-indigo-600",
                    under_review: "bg-purple-500/10 text-purple-600",
                    milestone_check: "bg-orange-500/10 text-orange-600",
                    released: "bg-green-500/10 text-green-600",
                    refunded: "bg-gray-500/10 text-gray-600",
                    disputed: "bg-red-500/10 text-red-600",
                  };
                  const phaseProgress: Record<string, number> = {
                    awaiting_deposit: 10,
                    funded: 25,
                    in_progress: 50,
                    under_review: 70,
                    milestone_check: 80,
                    released: 100,
                    refunded: 100,
                    disputed: 50,
                  };
                  const isDepositor = escrow.depositorId === user?.id;

                  return (
                    <motion.div
                      key={escrow.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card data-testid={`card-escrow-${escrow.id}`}>
                        <CardHeader className="pb-2 flex-row items-start justify-between gap-2 flex-wrap">
                          <div>
                            <CardTitle className="text-base">Escrow #{escrow.id}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                              <Link href={`/orders/${escrow.orderId}`} className="hover:underline">Order #{escrow.orderId}</Link> &middot; {isDepositor ? "You deposited" : "You receive"}
                            </p>
                          </div>
                          <Badge className={`text-xs capitalize ${phaseColors[escrow.phase] ?? ""}`}>
                            {escrow.phase.replace(/_/g, " ")}
                          </Badge>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Progress</span>
                              <span>{phaseProgress[escrow.phase] ?? 0}%</span>
                            </div>
                            <Progress value={phaseProgress[escrow.phase] ?? 0} className="h-1.5" />
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-lg font-bold font-mono">{escrow.amount} <span className="text-xs text-muted-foreground font-sans">SOL</span></p>
                            {escrow.expiresAt && (
                              <span className="text-xs text-muted-foreground">
                                Expires {format(new Date(escrow.expiresAt), "MMM d, yyyy")}
                              </span>
                            )}
                          </div>
                          {escrow.phase === "awaiting_deposit" && isDepositor && (
                            <Button
                              size="sm"
                              className="rounded-full text-xs"
                              disabled={loadingEscrowId === escrow.id}
                              onClick={async () => {
                                if (!solanaEscrow.isReady) {
                                  toast({ title: "Wallet not connected", variant: "destructive" });
                                  return;
                                }
                                setLoadingEscrowId(escrow.id);
                                try {
                                  const amountLamports = solToLamports(escrow.amount);
                                  const txSig = await solanaEscrow.initializeAndFund(
                                    escrow.receiverId, escrow.id, amountLamports, 30
                                  );
                                  updateEscrowPhase({ id: escrow.id, phase: "funded", txHash: txSig });
                                  toast({ title: "Escrow Funded", description: `Tx: ${txSig.slice(0, 12)}...` });
                                } catch (err: any) {
                                  const msg = err?.message || "Unexpected error";
                                  console.error("[Fund Escrow]", err);
                                  toast({ title: "Transaction Failed", description: msg, variant: "destructive" });
                                } finally {
                                  setLoadingEscrowId(null);
                                }
                              }}
                            >
                              {loadingEscrowId === escrow.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Fund Escrow
                            </Button>
                          )}
                          {escrow.phase === "funded" && !isDepositor && (
                            <Button
                              size="sm"
                              className="rounded-full text-xs"
                              disabled={loadingEscrowId === escrow.id}
                              onClick={async () => {
                                if (!solanaEscrow.isReady) {
                                  toast({ title: "Wallet not connected", variant: "destructive" });
                                  return;
                                }
                                setLoadingEscrowId(escrow.id);
                                try {
                                  await solanaEscrow.advancePhase(escrow.depositorId, escrow.id, "in_progress");
                                  updateEscrowPhase({ id: escrow.id, phase: "in_progress" });
                                } catch (err: any) {
                                  toast({ title: "Transaction failed", description: err?.message, variant: "destructive" });
                                } finally {
                                  setLoadingEscrowId(null);
                                }
                              }}
                            >
                              {loadingEscrowId === escrow.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Start Work
                            </Button>
                          )}
                          {escrow.phase === "in_progress" && !isDepositor && (
                            <Button
                              size="sm"
                              className="rounded-full text-xs"
                              disabled={loadingEscrowId === escrow.id}
                              onClick={async () => {
                                if (!solanaEscrow.isReady) {
                                  toast({ title: "Wallet not connected", variant: "destructive" });
                                  return;
                                }
                                setLoadingEscrowId(escrow.id);
                                try {
                                  await solanaEscrow.advancePhase(escrow.depositorId, escrow.id, "under_review");
                                  updateEscrowPhase({ id: escrow.id, phase: "under_review" });
                                } catch (err: any) {
                                  toast({ title: "Transaction failed", description: err?.message, variant: "destructive" });
                                } finally {
                                  setLoadingEscrowId(null);
                                }
                              }}
                            >
                              {loadingEscrowId === escrow.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Submit for Review
                            </Button>
                          )}
                          {escrow.phase === "under_review" && isDepositor && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full text-xs"
                                disabled={loadingEscrowId === escrow.id}
                                onClick={async () => {
                                  if (!solanaEscrow.isReady) {
                                    toast({ title: "Wallet not connected", variant: "destructive" });
                                    return;
                                  }
                                  setLoadingEscrowId(escrow.id);
                                  try {
                                    await solanaEscrow.advancePhase(escrow.depositorId, escrow.id, "disputed");
                                    updateEscrowPhase({ id: escrow.id, phase: "disputed" });
                                    if (solanaRep.isReady && user) {
                                      try { await solanaRep.recordDispute(user.id, escrow.id); } catch (err: any) { console.error(err); }
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Transaction failed", description: err?.message, variant: "destructive" });
                                  } finally {
                                    setLoadingEscrowId(null);
                                  }
                                }}
                              >
                                {loadingEscrowId === escrow.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />}
                                Dispute
                              </Button>
                              <Button
                                size="sm"
                                className="rounded-full text-xs"
                                disabled={loadingEscrowId === escrow.id}
                                onClick={async () => {
                                  if (!solanaEscrow.isReady) {
                                    toast({ title: "Wallet not connected", variant: "destructive" });
                                    return;
                                  }
                                  setLoadingEscrowId(escrow.id);
                                  try {
                                    const txSig = await solanaEscrow.releaseFunds(escrow.id, escrow.receiverId);
                                    updateEscrowPhase({ id: escrow.id, phase: "released", txHash: txSig });
                                    toast({ title: "Funds Released", description: `Tx: ${txSig.slice(0, 12)}...` });
                                    if (solanaRep.isReady && user) {
                                      const amountLamports = solToLamports(escrow.amount);
                                      try { await solanaRep.recordCompletion(user.id, escrow.id, amountLamports, isDepositor); } catch (err: any) { console.error(err); }
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Release Failed", description: err?.message, variant: "destructive" });
                                  } finally {
                                    setLoadingEscrowId(null);
                                  }
                                }}
                              >
                                {loadingEscrowId === escrow.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                                Approve & Release
                              </Button>
                            </div>
                          )}
                          {escrow.phase === "disputed" && isDepositor && (() => {
                            const disputeOpenedAt = escrow.disputeOpenedAt;
                            const canRefund = disputeOpenedAt && Date.now() / 1000 > new Date(disputeOpenedAt).getTime() / 1000 + 12 * 3600;
                            return (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                  {canRefund
                                    ? "Dispute window expired. You may claim a refund."
                                    : "Seller has 12 hours to submit evidence. After that, you may claim a refund."}
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full text-xs"
                                    disabled={isVerifying}
                                    onClick={() => {
                                      verifyContract(escrow.orderId, {
                                        onSuccess: (data: any) => {
                                          if (data.status === "verified") {
                                            toast({ title: "Verified", description: data.message });
                                          } else if (data.status === "not_found" || data.status === "insufficient") {
                                            toast({ title: "Not Verified", description: data.message, variant: "destructive" });
                                          } else {
                                            toast({ title: "Manual Review", description: data.message });
                                          }
                                        },
                                        onError: (err: any) => {
                                          toast({ title: "Error", description: err?.message, variant: "destructive" });
                                        },
                                      });
                                    }}
                                  >
                                    {isVerifying ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
                                    Verify Contract
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full text-xs"
                                    disabled={!canRefund || loadingEscrowId === escrow.id}
                                    onClick={async () => {
                                      if (!solanaEscrow.isReady) {
                                        toast({ title: "Wallet not connected", variant: "destructive" });
                                        return;
                                      }
                                      setLoadingEscrowId(escrow.id);
                                      try {
                                        const txSig = await solanaEscrow.refund(escrow.depositorId, escrow.id);
                                        updateEscrowPhase({ id: escrow.id, phase: "refunded", txHash: txSig });
                                        toast({ title: "Refund Processed", description: `Tx: ${txSig.slice(0, 12)}...` });
                                      } catch (err: any) {
                                        toast({ title: "On-chain refund failed", description: err?.message, variant: "destructive" });
                                      } finally {
                                        setLoadingEscrowId(null);
                                      }
                                    }}
                                  >
                                    {loadingEscrowId === escrow.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                    Claim Refund
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}
                          {escrow.phase === "disputed" && !isDepositor && (
                            <div className="space-y-3 border border-dashed border-red-500/30 rounded-md p-3">
                              <p className="text-xs font-medium flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                                Dispute — Automatic Verification
                              </p>
                              <p className="text-xs text-muted-foreground">
                                The buyer can trigger automatic verification of your contract. Make sure you have posted the required keyword in your tweets.
                              </p>
                              <Button
                                size="sm"
                                className="rounded-full text-xs"
                                disabled={isDisputeResolving}
                                onClick={() => {
                                  disputeResolve(
                                    { escrowId: escrow.id },
                                    {
                                      onSuccess: (data: any) => {
                                        if (data.resolution === "released" && data.matchingPosts >= data.requiredPosts) {
                                          toast({ title: "Verified", description: "Evidence confirmed — funds released to you." });
                                        } else if (data.resolution === "released" && data.matchingPosts > 0) {
                                          const pct = Math.round((data.matchingPosts / data.requiredPosts) * 100);
                                          toast({ title: "Partial Delivery", description: `${data.matchingPosts} of ${data.requiredPosts} posts verified — ${pct}% released to seller, rest refunded.` });
                                        } else if (data.resolution === "refunded") {
                                          toast({ title: "Not Verified", description: "No matching posts found — funds refunded to buyer.", variant: "destructive" });
                                        } else {
                                          toast({ title: "Manual Review", description: data.message });
                                        }
                                      },
                                      onError: (err: any) => {
                                        toast({ title: "Error", description: err?.message, variant: "destructive" });
                                      },
                                    }
                                  );
                                }}
                              >
                                {isDisputeResolving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
                                Submit for Verification
                              </Button>
                            </div>
                          )}
                          {escrow.phase === "released" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full text-xs"
                                onClick={() => setRatingTarget({
                                  orderId: escrow.orderId,
                                  escrowId: escrow.id,
                                  targetId: isDepositor ? escrow.receiverId : escrow.depositorId,
                                  depositorId: escrow.depositorId,
                                })}
                              >
                                <Star className="mr-1 h-3 w-3" /> Rate
                              </Button>
                              {isDepositor && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-full text-xs"
                                  onClick={async () => {
                                    if (solanaEscrow.isReady) {
                                      try {
                                        await solanaEscrow.closeEscrow(escrow.id);
                                        toast({ title: "Escrow Closed", description: "On-chain account reclaimed." });
                                      } catch (err: any) { console.error(err); }
                                    }
                                  }}
                                >
                                  Close Escrow
                                </Button>
                              )}
                            </div>
                          )}
                          <MilestonePanel
                            escrowId={escrow.id}
                            escrow={escrow}
                            milestones={escrow.milestones ?? []}
                            isDepositor={isDepositor}
                          />
                          <ChatPanel
                            orderId={escrow.orderId}
                            recipientId={isDepositor ? escrow.receiverId : escrow.depositorId}
                          />
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="buying">
          {ordersLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : orders?.length === 0 ? (
            <div className="text-center py-20 border border-dashed rounded-md" data-testid="text-no-orders">
              <Package className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold mb-2">No orders yet</h3>
              <p className="text-muted-foreground text-sm">Head to the marketplace to make your first purchase.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence>
                {orders?.map((order: Order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="selling">
          {salesLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : sales?.length === 0 ? (
            <div className="text-center py-20 border border-dashed rounded-md" data-testid="text-no-sales">
              <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold mb-2">No sales yet</h3>
              <p className="text-muted-foreground text-sm">List a service to start earning SOL.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence>
                {sales?.map((order: Order) => (
                  <OrderCard key={order.id} order={order} isSeller />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat">
          {convsLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : openChat !== null ? (() => {
            const conv = conversations?.find((c: Conversation) => c.orderId === openChat);
            if (!conv) return null;
            return (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setOpenChat(null)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <div>
                    <p className="text-sm font-medium">{conv.serviceTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {conv.counterpartyHandle ? `@${conv.counterpartyHandle}` : conv.counterpartyId.slice(0, 8) + "..."}
                      {" "}&middot; You are the {conv.role}
                    </p>
                  </div>
                </div>
                <ChatPanel orderId={openChat} recipientId={conv.counterpartyId} />
              </motion.div>
            );
          })() : !conversations?.length ? (
            <div className="text-center py-20 border border-dashed rounded-md" data-testid="text-no-conversations">
              <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold mb-2">No conversations yet</h3>
              <p className="text-muted-foreground text-sm">Conversations appear here when you buy or sell a service.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              <AnimatePresence>
                {conversations.map((conv: Conversation) => {
                  const unreadIds = unreadByOrderId.get(conv.orderId);
                  const unreadCount = unreadIds?.length ?? 0;
                  return (
                    <motion.div
                      key={conv.orderId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${unreadCount > 0 ? "border-red-500/40" : ""}`}
                        onClick={() => setOpenChat(conv.orderId)}
                        data-testid={`card-conversation-${conv.orderId}`}
                      >
                        <CardContent className="py-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{conv.serviceTitle}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {conv.counterpartyHandle ? `@${conv.counterpartyHandle}` : conv.counterpartyId.slice(0, 8) + "..."}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-[10px] capitalize">{conv.role}</Badge>
                            <StatusBadge status={conv.orderStatus} />
                            {unreadCount > 0 && (
                              <span className="h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                            <Link
                              href={`/orders/${conv.orderId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                              title="Open order"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {ratingTarget && (
        <RatingModal
          orderId={ratingTarget.orderId}
          escrowId={ratingTarget.escrowId}
          targetId={ratingTarget.targetId}
          depositorId={ratingTarget.depositorId}
          open={!!ratingTarget}
          onOpenChange={(open) => { if (!open) setRatingTarget(null); }}
        />
      )}
    </div>
  );
}
