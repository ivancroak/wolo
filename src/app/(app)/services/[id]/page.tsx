"use client";

import { useParams, useRouter } from "next/navigation";
import { useService } from "@/hooks/use-services";
import { useAuth } from "@/hooks/use-auth";
import { PurchaseModal } from "@/components/PurchaseModal";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, Briefcase, CalendarClock, ShieldCheck, Clock, ArrowUpRight, Image, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

const categoryIcons: Record<string, React.ReactNode> = {
  content: <Image className="h-4 w-4" />,
};

const pricingLabels: Record<string, string> = {
  fixed: "Fixed Price",
  payroll: "Payroll",
};

const pricingIcons: Record<string, React.ReactNode> = {
  fixed: <Briefcase className="h-4 w-4" />,
  payroll: <CalendarClock className="h-4 w-4" />,
};

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = Number(params.id);
  const { data: service, isLoading } = useService(id);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { toast } = useToast();
  const { sellerCancel } = useSolanaEscrow();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <h2 className="text-xl font-bold mb-2">Service not found</h2>
        <p className="text-muted-foreground mb-6">This listing may have been removed.</p>
        <Button variant="outline" onClick={() => router.push("/marketplace")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace
        </Button>
      </div>
    );
  }

  const isOwn = user?.id === service.creatorId;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Button variant="ghost" size="sm" onClick={() => router.push("/marketplace")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Marketplace
        </Button>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {service.listingType === "request" && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-600">Request</Badge>
                  )}
                  <Badge variant="secondary" className="gap-1.5">
                    {categoryIcons[service.category] ?? <Image className="h-4 w-4" />}
                    <span className="capitalize">{service.category}</span>
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{service.title}</h1>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-foreground text-background font-bold">
                      {service.creatorTwitterHandle ? service.creatorTwitterHandle.slice(0, 2).toUpperCase() : service.creatorId.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {service.creatorTwitterHandle ? (
                    <a
                      href={`https://x.com/${service.creatorTwitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{service.creatorTwitterHandle}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground font-mono">{service.creatorId.slice(0, 16)}...</span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  {service.listingType === "request" ? "Budget" : "Price"}
                </span>
                <p className="text-3xl font-bold font-mono tracking-tight">
                  {service.price} <span className="text-sm text-muted-foreground font-sans">SOL</span>
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{service.description}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {service.pricingCategory && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Pricing Model</span>
                  <div className="flex items-center gap-1.5">
                    {pricingIcons[service.pricingCategory]}
                    <span className="text-sm font-medium">
                      {pricingLabels[service.pricingCategory] ?? service.pricingCategory}
                      {service.payrollBasis ? ` / ${service.payrollBasis}` : ""}
                    </span>
                  </div>
                </div>
              )}

              {service.contentType && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Content Type</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium capitalize">
                      {service.contentType === "mixed" ? "Posts + Threads" : service.contentType}
                    </span>
                  </div>
                </div>
              )}

              {service.requiredKeyword && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {service.listingType === "request" ? "Required Keyword" : "Keywords"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-sm font-medium font-mono">{service.requiredKeyword}</span>
                  </div>
                </div>
              )}

              {service.minPostCount && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {service.contentType === "threads" ? "Min Threads" : "Min Posts"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {service.minPostCount} {service.contentType === "threads" ? "threads" : "posts"}
                    </span>
                  </div>
                </div>
              )}

              {service.postsPerPeriod && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Posts per Period</span>
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" />
                    <span className="text-sm font-medium">{service.postsPerPeriod} / {service.payrollBasis ?? "period"}</span>
                  </div>
                </div>
              )}

              {service.threadsPerPeriod && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Threads per Period</span>
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" />
                    <span className="text-sm font-medium">{service.threadsPerPeriod} / {service.payrollBasis ?? "period"}</span>
                  </div>
                </div>
              )}

              {service.maxActions && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Max Buyers</span>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-sm font-medium">{service.actionsCompleted} / {service.maxActions}</span>
                  </div>
                </div>
              )}

              {service.deadlineDays && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Deadline</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">{service.deadlineDays} day{service.deadlineDays !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              )}

              {service.imageUrl && (
                <div className="space-y-1 col-span-full">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Reference URL</span>
                  <a href={service.imageUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline break-all">
                    {service.imageUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="pt-4 border-t flex justify-end gap-3">
              {isOwn && service.active ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="rounded-full" disabled={isCancelling}>
                      {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Cancel Listing
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Cancel this listing?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will deactivate the listing and cancel all active orders.
                        {service.listingType === "offer"
                          ? " Any locked payments will be refunded to the buyers (no platform fee)."
                          : " This is only possible if no payments have been locked yet."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Listing</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={async () => {
                          setIsCancelling(true);
                          try {
                            const res = await apiRequest("POST", `/api/services/${id}/cancel`);
                            const data = await res.json();
                            // Process on-chain refunds for funded escrows
                            if (data.escrowsToRefund?.length > 0) {
                              for (const esc of data.escrowsToRefund) {
                                try {
                                  await sellerCancel(esc.depositorWalletAddress, esc.escrowId);
                                  // Sync on-chain phase to DB after successful refund
                                  await fetch(`/api/escrow/${esc.escrowId}/sync`, {
                                    method: "POST",
                                    credentials: "include",
                                  });
                                  toast({ title: "Payment Refunded", description: `On-chain refund completed for order payment #${esc.escrowId}` });
                                } catch (txErr: any) {
                                  toast({ title: "On-chain refund failed", description: txErr.message, variant: "destructive" });
                                }
                              }
                            }
                            toast({ title: "Listing Cancelled", description: `${data.ordersAffected} order(s) cancelled.` });
                            queryClient.invalidateQueries({ queryKey: [`/api/services/${id}`] });
                            queryClient.invalidateQueries({ queryKey: ["/api/services"] });
                            router.push("/dashboard");
                          } catch (err: any) {
                            const msg = await err?.response?.json?.().catch(() => null);
                            toast({ title: "Cancel failed", description: msg?.message || err.message, variant: "destructive" });
                          } finally {
                            setIsCancelling(false);
                          }
                        }}
                      >
                        Cancel Listing
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : isOwn && !service.active ? (
                <Badge variant="destructive" className="text-sm px-4 py-1.5">Listing Cancelled</Badge>
              ) : (
                <Button onClick={() => {
                  if (!user) {
                    toast({ title: "Wallet not connected", description: "Please connect your wallet to continue.", variant: "destructive" });
                    return;
                  }
                  setPurchaseOpen(true);
                }} className="rounded-full px-8">
                  {service.listingType === "request" ? "Fulfill Request" : "Buy"}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <PurchaseModal service={service} open={purchaseOpen} onOpenChange={setPurchaseOpen} />
    </div>
  );
}
