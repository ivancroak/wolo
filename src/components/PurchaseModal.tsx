"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateOrder, useUpdateOrder } from "@/hooks/use-orders";
import { useCreateEscrow, useUpdateEscrowPhase } from "@/hooks/use-escrow";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, Lock, Clock, ShieldCheck, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";

const SOL_DECIMALS = 9;

function solToLamports(sol: string): number {
  const parts = sol.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").padEnd(9, "0").slice(0, 9);
  return Number(BigInt(whole) * BigInt(1_000_000_000) + BigInt(frac));
}

import { type Service } from "@shared/schema";

const formSchema = z.object({
  requirements: z.string().min(10, "Please provide detailed requirements"),
  requiredKeyword: z.string().optional(),
  totalPeriods: z.number().int().min(1).max(52).optional(),
});


interface PurchaseModalProps {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseModal({ service, open, onOpenChange }: PurchaseModalProps) {
  const { mutateAsync: createOrder, isPending: orderPending } = useCreateOrder();
  const { mutateAsync: updateOrder } = useUpdateOrder();
  const { mutateAsync: createEscrow } = useCreateEscrow();
  const { mutateAsync: updateEscrowPhase } = useUpdateEscrowPhase();
  const { isReady: escrowReady, initializeAndFund } = useSolanaEscrow();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRequest = service?.listingType === "request";
  const isPayroll = service?.pricingCategory === "payroll";
  const defaultPeriods = isPayroll ? 4 : undefined;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requirements: "",
      requiredKeyword: isRequest ? (service?.requiredKeyword ?? "") : "",
      totalPeriods: isPayroll ? defaultPeriods : undefined,
    },
  });

  const selectedPeriods = form.watch("totalPeriods");
  const totalPrice = isPayroll && selectedPeriods ? (Number(service?.price ?? 0) * selectedPeriods).toFixed(4).replace(/\.?0+$/, "") : service?.price;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!service) return;
    if (!user) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to purchase a service.",
        variant: "destructive",
      });
      return;
    }
    if (user.id === service.creatorId) {
      toast({
        title: "Cannot purchase your own service",
        variant: "destructive",
      });
      return;
    }
    if (!profile?.walletAddress || !profile?.twitterHandle || !profile?.twitterVerified) {
      toast({
        title: "Profile incomplete",
        description: "Set your wallet address and verify your X handle in Profile before purchasing.",
        variant: "destructive",
      });
      router.push("/profile");
      onOpenChange(false);
      return;
    }
    if (!isRequest && !values.requiredKeyword?.trim()) {
      toast({
        title: "Required keyword missing",
        description: "Please enter a keyword for tweet verification.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const orderRes = await createOrder({
        serviceId: service.id,
        requirements: values.requirements,
        requiredKeyword: isRequest ? (service.requiredKeyword ?? undefined) : (values.requiredKeyword?.trim() || undefined),
      });

      const receiverId = isRequest ? user.id : service.creatorId;

      const escrowAmount = isPayroll && values.totalPeriods
        ? (Number(service.price) * values.totalPeriods).toFixed(9).replace(/\.?0+$/, "")
        : service.price;

      const escrowBody: any = {
        orderId: orderRes.id,
        receiverId,
        amount: escrowAmount,
        expiresInDays: service.deadlineDays ?? 7,
      };
      if (isPayroll && values.totalPeriods) {
        escrowBody.totalPeriods = values.totalPeriods;
      }

      let escrowRes;
      try {
        escrowRes = await createEscrow(escrowBody);
      } catch (escrowErr: any) {
        // Cancel orphaned order if escrow creation fails
        try { await updateOrder({ id: orderRes.id, status: "cancelled" }); } catch {}
        throw escrowErr;
      }

      if (escrowReady) {
        try {
          const receiverWallet = escrowRes.receiverWalletAddress;
          if (!receiverWallet) {
            throw new Error("Receiver has no wallet address set. They must configure their wallet in Profile first.");
          }
          const amountLamports = solToLamports(escrowAmount);
          const expiresInDays = escrowRes.expiresAt
            ? Math.max(1, Math.ceil((new Date(escrowRes.expiresAt).getTime() - Date.now()) / 86400000))
            : (service.deadlineDays ?? 7);
          const txSig = await initializeAndFund(receiverWallet, escrowRes.id, amountLamports, expiresInDays);
          await updateEscrowPhase({ id: escrowRes.id, phase: "funded", txHash: txSig });
          toast({
            title: "Escrow Funded On-Chain",
            description: `Transaction: ${txSig.slice(0, 8)}...`,
          });
          onOpenChange(false);
          form.reset();
          toast({ title: "Order Placed", description: "Check your dashboard for escrow status." });
          router.push("/dashboard");
        } catch (txErr: any) {
          onOpenChange(false);
          form.reset();
          toast({
            title: "Order created but escrow not funded",
            description: txErr?.message || "On-chain transaction failed. Go to your dashboard to retry funding.",
            variant: "destructive",
          });
          router.push("/dashboard");
        }
      } else {
        onOpenChange(false);
        form.reset();
        toast({ title: "Order Placed", description: "Check your dashboard for escrow status." });
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to create order.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" data-testid="modal-purchase">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isRequest ? "Fulfill Request" : "Confirm Purchase"}
          </DialogTitle>
          <DialogDescription>
            {isRequest ? "You are fulfilling " : "You are purchasing "}
            <span className="font-semibold text-foreground">{service.title}</span> for <span className="font-bold text-foreground font-mono">{totalPrice} SOL</span>
            {isPayroll && selectedPeriods ? <span className="text-xs"> ({service.price} SOL/{service.payrollBasis === "monthly" ? "mo" : "wk"} &times; {selectedPeriods})</span> : null}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <FormField
              control={form.control}
              name="requirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isRequest ? "Your Proposal" : "Requirements"}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={isRequest
                        ? "Describe how you will fulfill this request..."
                        : "Include links to posts, specific text, or other instructions..."}
                      className="min-h-[120px]"
                      {...field}
                      data-testid="input-requirements"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isRequest && (
              <FormField
                control={form.control}
                name="requiredKeyword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Required Keyword *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. #SolanaDefi or @woloprotocol"
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-order-keyword"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">This keyword will be verified in the seller&apos;s tweets.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isPayroll && (
              <FormField
                control={form.control}
                name="totalPeriods"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of {service.payrollBasis === "monthly" ? "Months" : "Weeks"}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="52"
                        step="1"
                        placeholder={`e.g. ${service.payrollBasis === "monthly" ? "3" : "4"}`}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-total-periods"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Total: <span className="font-mono font-medium">{totalPrice} SOL</span> locked in escrow, released {service.payrollBasis === "monthly" ? "monthly" : "weekly"} after each period.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-2">
              {isPayroll && (
                <div className="flex items-start gap-3 p-3 rounded-md bg-muted text-sm">
                  <Repeat className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Recurring Payroll</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {service.price} SOL released each {service.payrollBasis === "monthly" ? "month" : "week"} after a 48-hour dispute window.
                    </p>
                  </div>
                </div>
              )}
              {(service.requiredKeyword || service.minPostCount || service.postsPerPeriod || service.deadlineDays) && (
                <div className="flex items-start gap-3 p-3 rounded-md bg-muted text-sm">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Contract Parameters</p>
                    <div className="text-muted-foreground text-xs mt-0.5 space-y-0.5">
                      {service.requiredKeyword && <p>Keyword: <span className="font-mono text-foreground">{service.requiredKeyword}</span></p>}
                      {service.minPostCount && <p>Min posts: {service.minPostCount}</p>}
                      {service.postsPerPeriod && <p>Posts per period: {service.postsPerPeriod}</p>}
                      {service.deadlineDays && <p>Deadline: {service.deadlineDays} day{service.deadlineDays !== 1 ? "s" : ""}</p>}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted text-sm">
                <Shield className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Escrow Protected</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Payment is locked in on-chain escrow and released only after the service is verified complete.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted text-sm">
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Encrypted Communication</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    All messages between parties are end-to-end encrypted.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted text-sm">
                <Clock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">12-Hour Settlement</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Escrow settles within 12 hours with automatic dispute resolution.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-purchase">Cancel</Button>
              <Button type="submit" disabled={isSubmitting || orderPending} data-testid="button-confirm-purchase">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isRequest ? "Submit & Lock Escrow" : "Accept Offer & Lock Escrow"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
