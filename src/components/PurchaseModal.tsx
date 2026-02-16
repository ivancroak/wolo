"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateOrder } from "@/hooks/use-orders";
import { useCreateEscrow, useUpdateEscrowPhase } from "@/hooks/use-escrow";
import { useSolanaEscrow } from "@/hooks/use-solana-escrow";
import { useAuth } from "@/hooks/use-auth";
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
import { Loader2, Shield, Lock, Clock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MINT = process.env.NEXT_PUBLIC_SPL_TOKEN_MINT || "";
const TOKEN_DECIMALS = 6;

const formSchema = z.object({
  requirements: z.string().min(10, "Please provide detailed requirements"),
});

interface PurchaseModalProps {
  service: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseModal({ service, open, onOpenChange }: PurchaseModalProps) {
  const { mutateAsync: createOrder, isPending: orderPending } = useCreateOrder();
  const { mutateAsync: createEscrow } = useCreateEscrow();
  const { mutateAsync: updateEscrowPhase } = useUpdateEscrowPhase();
  const { isReady: escrowReady, initializeAndFund } = useSolanaEscrow();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRequest = service?.listingType === "request";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { requirements: "" },
  });

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
    setIsSubmitting(true);

    try {
      const orderRes = await createOrder({
        serviceId: service.id,
        requirements: values.requirements,
      });

      const receiverId = isRequest ? user.id : service.creatorId;

      const escrowRes = await createEscrow({
        orderId: orderRes.id,
        receiverId,
        amount: service.price,
        expiresInDays: 30,
      });

      if (escrowReady && MINT) {
        try {
          const amountLamports = Math.round(parseFloat(service.price) * Math.pow(10, TOKEN_DECIMALS));
          const txSig = await initializeAndFund(receiverId, MINT, escrowRes.id, amountLamports, 30);
          await updateEscrowPhase({ id: escrowRes.id, phase: "funded", txHash: txSig });
          toast({
            title: "Escrow Funded On-Chain",
            description: `Transaction: ${txSig.slice(0, 8)}...`,
          });
        } catch (txErr: any) {
          toast({
            title: "On-chain escrow skipped",
            description: txErr?.message || "Transaction rejected. Escrow record created off-chain.",
            variant: "destructive",
          });
        }
      }

      onOpenChange(false);
      form.reset();
      toast({ title: "Order Placed", description: "Check your dashboard for escrow status." });
      router.push("/dashboard");
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
            <span className="font-semibold text-foreground">{service.title}</span> for <span className="font-bold text-foreground font-mono">{service.price} SOL</span>.
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

            <div className="space-y-2">
              {service.pricingCategory === "pay_per_action" && (service.maxActions || service.budgetCap) && (
                <div className="flex items-start gap-3 p-3 rounded-md bg-muted text-sm">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Spending Caps</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {service.maxActions && `Max ${service.maxActions} actions`}
                      {service.maxActions && service.budgetCap && " \u2022 "}
                      {service.budgetCap && `Budget capped at ${service.budgetCap} SOL`}
                    </p>
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
                  <p className="font-medium text-foreground">30-Day Guarantee</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Escrow expires after 30 days with automatic dispute resolution.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-purchase">Cancel</Button>
              <Button type="submit" disabled={isSubmitting || orderPending} data-testid="button-confirm-purchase">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isRequest ? "Submit & Lock Escrow" : "Purchase & Lock Escrow"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
