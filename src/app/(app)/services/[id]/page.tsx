"use client";

import { useParams, useRouter } from "next/navigation";
import { useService, useCompleteAction } from "@/hooks/use-services";
import { useAuth } from "@/hooks/use-auth";
import { PurchaseModal } from "@/components/PurchaseModal";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, Heart, Repeat, UserPlus, Users, Sparkles, DollarSign, Briefcase, CalendarClock, ShieldCheck, Clock, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const categoryIcons: Record<string, React.ReactNode> = {
  repost: <Repeat className="h-4 w-4" />,
  like: <Heart className="h-4 w-4" />,
  follow: <UserPlus className="h-4 w-4" />,
  ambassador: <Users className="h-4 w-4" />,
  custom: <Sparkles className="h-4 w-4" />,
};

const pricingLabels: Record<string, string> = {
  pay_per_action: "Pay Per Action",
  full_service: "Full Service",
  payroll: "Payroll",
};

const pricingIcons: Record<string, React.ReactNode> = {
  pay_per_action: <DollarSign className="h-4 w-4" />,
  full_service: <Briefcase className="h-4 w-4" />,
  payroll: <CalendarClock className="h-4 w-4" />,
};

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = Number(params.id);
  const { data: service, isLoading } = useService(id);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const { toast } = useToast();
  const { mutate: completeAction, isPending: actionPending } = useCompleteAction();

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
                    {categoryIcons[service.category] ?? <Sparkles className="h-4 w-4" />}
                    <span className="capitalize">{service.category}</span>
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{service.title}</h1>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-foreground text-background font-bold">
                      {service.creatorId.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground font-mono">{service.creatorId.slice(0, 16)}...</span>
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

              {service.pricingCategory === "pay_per_action" && service.maxActions && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Progress</span>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-sm font-medium">{service.actionsCompleted} / {service.maxActions} actions</span>
                  </div>
                </div>
              )}

              {service.pricingCategory === "pay_per_action" && service.maxActions && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Payout / Action</span>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {(parseFloat(service.budgetCap || service.price) / service.maxActions).toFixed(4)} SOL
                    </span>
                  </div>
                </div>
              )}

              {service.pricingCategory === "pay_per_action" && service.budgetCap && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Budget Cap</span>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-sm font-medium">{service.budgetCap} SOL</span>
                  </div>
                </div>
              )}

              {service.listingType === "request" && service.deadlineDays && (
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

            <div className="pt-4 border-t flex justify-end">
              {isOwn ? (
                <Badge variant="outline" className="text-muted-foreground">This is your listing</Badge>
              ) : service.pricingCategory === "pay_per_action" ? (
                <Button
                  disabled={actionPending}
                  onClick={() => {
                    if (!user) {
                      toast({ title: "Wallet not connected", description: "Please connect your wallet to continue.", variant: "destructive" });
                      return;
                    }
                    completeAction(service.id, {
                      onSuccess: (data: any) => {
                        toast({ title: "Action Completed", description: `Payout: ${data.payoutPerAction} SOL` });
                      },
                      onError: (err: any) => {
                        toast({ title: "Error", description: err.message, variant: "destructive" });
                      },
                    });
                  }}
                  className="rounded-full px-8"
                >
                  {actionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Complete Action
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => {
                  if (!user) {
                    toast({ title: "Wallet not connected", description: "Please connect your wallet to continue.", variant: "destructive" });
                    return;
                  }
                  setPurchaseOpen(true);
                }} className="rounded-full px-8">
                  {service.listingType === "request" ? "Fulfill Request" : "Purchase Service"}
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
