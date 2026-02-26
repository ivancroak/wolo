"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyOrders, useMySales, useUpdateOrder } from "@/hooks/use-orders";
import { useMyServices, useActionCompletions, useDisputeAction } from "@/hooks/use-services";
import { useMyEscrows, useUpdateEscrowPhase, useDisputeResolve } from "@/hooks/use-escrow";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useSolanaReputation } from "@/hooks/use-solana-reputation";
import { useMyReputation } from "@/hooks/use-reputation";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Loader2, Package, TrendingUp, CheckCircle, XCircle, LayoutList, Shield, Star, Award, AlertTriangle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { motion, AnimatePresence } from "framer-motion";
import { ChatPanel } from "@/components/ChatPanel";
import { MilestonePanel } from "@/components/MilestonePanel";
import { RatingModal } from "@/components/RatingModal";
import { type Order, type Service, type Escrow, type ActionCompletion } from "@shared/schema";

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
  const solanaEscrow = useSolanaEscrow();
  const solanaRep = useSolanaReputation();
  const { toast } = useToast();
  const [ratingTarget, setRatingTarget] = useState<{ orderId: number; escrowId?: number; targetId: string; depositorId?: string } | null>(null);
  const [evidenceInputs, setEvidenceInputs] = useState<Record<number, { tweetUrl?: string; targetHandle?: string }>>({});
  const [actionEvidenceInputs, setActionEvidenceInputs] = useState<Record<number, { tweetUrl?: string; targetHandle?: string }>>({});
  const [expandedActions, setExpandedActions] = useState<Record<number, boolean>>({});
  const { mutate: disputeAction, isPending: isActionDisputing } = useDisputeAction();

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

  const ActionStatusBadge = ({ status }: { status: string }) => {
    if (status === "verified") return <Badge variant="default" className="text-xs bg-green-600">verified</Badge>;
    if (status === "rejected") return <Badge variant="destructive" className="text-xs">rejected</Badge>;
    return <Badge variant="secondary" className="text-xs text-amber-600">completed</Badge>;
  };

  const ActionTrackingSection = ({ service }: { service: Service }) => {
    const { data: actions, isLoading } = useActionCompletions(service.id);
    const isExpanded = expandedActions[service.id] ?? false;
    const completions = (actions ?? []) as ActionCompletion[];
    const pct = service.maxActions ? Math.round((service.actionsCompleted / service.maxActions) * 100) : 0;

    return (
      <div className="space-y-3 pt-2 border-t border-border/50">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Actions</span>
            <span>{service.actionsCompleted} / {service.maxActions ?? "∞"}{service.maxActions ? ` (${pct}%)` : ""}</span>
          </div>
          <Progress value={service.maxActions ? pct : 0} className="h-1.5" />
        </div>

        {/* Toggle */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading actions…
          </div>
        ) : completions.length > 0 ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs w-full justify-between"
              onClick={() => setExpandedActions((prev) => ({ ...prev, [service.id]: !isExpanded }))}
            >
              <span>{isExpanded ? "Hide" : "Show"} {completions.length} action{completions.length !== 1 ? "s" : ""}</span>
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>

            {isExpanded && (
              <div className="space-y-2">
                {completions.map((ac: ActionCompletion) => {
                  const ev = actionEvidenceInputs[ac.id] ?? {};
                  const manualOnly = service.category === "like" || service.category === "ambassador" || service.category === "custom";

                  return (
                    <div key={ac.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-muted-foreground">
                            {ac.userId.slice(0, 4)}…{ac.userId.slice(-4)}
                          </span>
                          <ActionStatusBadge status={ac.status} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {ac.createdAt ? format(new Date(ac.createdAt), "MMM d, HH:mm") : ""}
                        </span>
                      </div>

                      {ac.status === "completed" && (
                        <div className="space-y-2 pt-1">
                          {manualOnly ? (
                            <p className="text-xs text-muted-foreground">Manual verification only for &ldquo;{service.category}&rdquo; category.</p>
                          ) : (
                            <>
                              {service.category === "repost" && (
                                <Input
                                  placeholder="Tweet URL (e.g. https://x.com/user/status/123)"
                                  className="text-xs h-8"
                                  value={ev.tweetUrl ?? ""}
                                  onChange={(e) => setActionEvidenceInputs((prev) => ({ ...prev, [ac.id]: { ...prev[ac.id], tweetUrl: e.target.value } }))}
                                />
                              )}
                              {service.category === "follow" && (
                                <Input
                                  placeholder="Target @handle (e.g. @elonmusk)"
                                  className="text-xs h-8"
                                  value={ev.targetHandle ?? ""}
                                  onChange={(e) => setActionEvidenceInputs((prev) => ({ ...prev, [ac.id]: { ...prev[ac.id], targetHandle: e.target.value } }))}
                                />
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full text-xs"
                                disabled={isActionDisputing}
                                onClick={() => {
                                  disputeAction(
                                    { serviceId: service.id, actionId: ac.id, tweetUrl: ev.tweetUrl, targetHandle: ev.targetHandle },
                                    {
                                      onSuccess: (data: any) => {
                                        const v = data.verification;
                                        if (v?.status === "verified") {
                                          toast({ title: "Verified", description: v.message });
                                        } else if (v?.status === "not_found") {
                                          toast({ title: "Rejected", description: v.message, variant: "destructive" });
                                        } else {
                                          toast({ title: "Manual Review", description: v?.message ?? "Could not auto-verify" });
                                        }
                                      },
                                      onError: (err: any) => {
                                        toast({ title: "Error", description: err?.message, variant: "destructive" });
                                      },
                                    }
                                  );
                                }}
                              >
                                {isActionDisputing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
                                Dispute
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No actions yet.</p>
        )}
      </div>
    );
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
                  <Badge key={b} variant="secondary" className="text-[10px]">{b.replace("_", " ")}</Badge>
                )) : <span className="text-xs text-muted-foreground">None yet</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Badges</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="listings" className="w-full">
        <TabsList className="mb-8 w-full max-w-lg grid grid-cols-4">
          <TabsTrigger value="listings" data-testid="tab-listings">Listings</TabsTrigger>
          <TabsTrigger value="escrows" data-testid="tab-escrows">Escrows</TabsTrigger>
          <TabsTrigger value="buying" data-testid="tab-buying">Buying</TabsTrigger>
          <TabsTrigger value="selling" data-testid="tab-selling">Selling</TabsTrigger>
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
                {myServices.map((service: Service) => (
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
                        <div className="flex gap-2">
                          <Badge
                            variant={service.listingType === "request" ? "outline" : "default"}
                            className={`text-xs capitalize ${service.listingType === "request" ? "border-amber-500/50 text-amber-600" : ""}`}
                          >
                            {service.listingType === "request" ? "Request" : "Offer"}
                          </Badge>
                          <Badge variant="secondary" className="text-xs capitalize">{service.category}</Badge>
                          <Badge variant={service.active ? "default" : "destructive"} className="text-xs">
                            {service.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{service.description}</p>
                        <p className="text-lg font-bold font-mono">{service.price} <span className="text-xs text-muted-foreground font-sans">SOL</span></p>
                        {service.pricingCategory === "pay_per_action" && (
                          <ActionTrackingSection service={service} />
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
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
                              Order #{escrow.orderId} &middot; {isDepositor ? "You deposited" : "You receive"}
                            </p>
                          </div>
                          <Badge className={`text-xs capitalize ${phaseColors[escrow.phase] ?? ""}`}>
                            {escrow.phase.replace("_", " ")}
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
                              onClick={async () => {
                                const mint = process.env.NEXT_PUBLIC_SPL_TOKEN_MINT;
                                if (!solanaEscrow.isReady || !mint) {
                                  toast({ title: "Wallet not connected", variant: "destructive" });
                                  return;
                                }
                                try {
                                  const amountLamports = Math.round(parseFloat(escrow.amount) * 1_000_000);
                                  const txSig = await solanaEscrow.initializeAndFund(
                                    escrow.receiverId, mint, escrow.id, amountLamports, 30
                                  );
                                  updateEscrowPhase({ id: escrow.id, phase: "funded", txHash: txSig });
                                  toast({ title: "Escrow Funded", description: `Tx: ${txSig.slice(0, 12)}...` });
                                } catch (err: any) {
                                  toast({ title: "Transaction Failed", description: err?.message, variant: "destructive" });
                                }
                              }}
                            >
                              Fund Escrow
                            </Button>
                          )}
                          {escrow.phase === "funded" && !isDepositor && (
                            <Button
                              size="sm"
                              className="rounded-full text-xs"
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
                              }}
                            >
                              Start Work
                            </Button>
                          )}
                          {escrow.phase === "in_progress" && !isDepositor && (
                            <Button
                              size="sm"
                              className="rounded-full text-xs"
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
                              }}
                            >
                              Submit for Review
                            </Button>
                          )}
                          {escrow.phase === "under_review" && isDepositor && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full text-xs"
                                onClick={async () => {
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
                                }}
                              >
                                <XCircle className="mr-1 h-3 w-3" />
                                Dispute
                              </Button>
                              <Button
                                size="sm"
                                className="rounded-full text-xs"
                                onClick={async () => {
                                  const mint = process.env.NEXT_PUBLIC_SPL_TOKEN_MINT;
                                  if (!solanaEscrow.isReady || !mint) {
                                    toast({ title: "Wallet not connected", variant: "destructive" });
                                    return;
                                  }
                                  try {
                                    const txSig = await solanaEscrow.releaseFunds(escrow.id, escrow.receiverId, mint);
                                    updateEscrowPhase({ id: escrow.id, phase: "released", txHash: txSig });
                                    toast({ title: "Funds Released", description: `Tx: ${txSig.slice(0, 12)}...` });
                                    if (solanaRep.isReady && user) {
                                      const amountLamports = Math.round(parseFloat(escrow.amount) * 1_000_000);
                                      try { await solanaRep.recordCompletion(user.id, escrow.id, amountLamports, isDepositor); } catch {}
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Release Failed", description: err?.message, variant: "destructive" });
                                  }
                                }}
                              >
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Approve & Release
                              </Button>
                            </div>
                          )}
                          {escrow.phase === "disputed" && isDepositor && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">Awaiting seller evidence. You can claim a refund at any time.</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full text-xs"
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
                                }}
                              >
                                Claim Refund
                              </Button>
                            </div>
                          )}
                          {escrow.phase === "disputed" && !isDepositor && (() => {
                            const cat = (escrow as any).serviceCategory as string | null;
                            const manualOnly = !cat || cat === "like" || cat === "ambassador" || cat === "custom";
                            const ev = evidenceInputs[escrow.id] ?? {};
                            return (
                              <div className="space-y-3 border border-dashed border-red-500/30 rounded-md p-3">
                                <p className="text-xs font-medium flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                  Dispute — Submit Evidence
                                </p>
                                {manualOnly ? (
                                  <p className="text-xs text-muted-foreground">
                                    This service category ({cat ?? "unknown"}) requires admin review. Please wait for manual resolution.
                                  </p>
                                ) : (
                                  <>
                                    {cat === "repost" && (
                                      <Input
                                        placeholder="Tweet URL (e.g. https://x.com/user/status/123)"
                                        className="text-xs h-8"
                                        value={ev.tweetUrl ?? ""}
                                        onChange={(e) => setEvidenceInputs((prev) => ({ ...prev, [escrow.id]: { ...prev[escrow.id], tweetUrl: e.target.value } }))}
                                      />
                                    )}
                                    {cat === "follow" && (
                                      <Input
                                        placeholder="Target @handle (e.g. @elonmusk)"
                                        className="text-xs h-8"
                                        value={ev.targetHandle ?? ""}
                                        onChange={(e) => setEvidenceInputs((prev) => ({ ...prev, [escrow.id]: { ...prev[escrow.id], targetHandle: e.target.value } }))}
                                      />
                                    )}
                                    <Button
                                      size="sm"
                                      className="rounded-full text-xs"
                                      disabled={isDisputeResolving}
                                      onClick={() => {
                                        disputeResolve(
                                          { escrowId: escrow.id, tweetUrl: ev.tweetUrl, targetHandle: ev.targetHandle },
                                          {
                                            onSuccess: (data: any) => {
                                              if (data.resolution === "released") {
                                                toast({ title: "Verified", description: "Evidence confirmed — funds released to you." });
                                              } else if (data.resolution === "refunded") {
                                                toast({ title: "Not Verified", description: "Evidence could not be confirmed — funds refunded to buyer.", variant: "destructive" });
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
                                      Submit Evidence
                                    </Button>
                                  </>
                                )}
                              </div>
                            );
                          })()}
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
                                      } catch {}
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
