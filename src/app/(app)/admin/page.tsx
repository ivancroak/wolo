"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Shield, Gavel, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Escrow } from "@shared/schema";

const ADMIN_WALLET = "2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL";

export default function AdminDisputesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [shares, setShares] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!authLoading && (!user || user.id !== ADMIN_WALLET)) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const { data: disputes, isLoading: disputesLoading } = useQuery<Escrow[]>({
    queryKey: ["/api/admin/disputes"],
    enabled: !!user && user.id === ADMIN_WALLET,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ escrowId, depositorShareBps }: { escrowId: number; depositorShareBps: number }) => {
      const res = await apiRequest("POST", `/api/admin/disputes/${escrowId}/resolve`, { depositorShareBps });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/disputes"] });
      toast({ title: "Dispute Resolved", description: "Escrow has been resolved and released." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message ?? "Failed to resolve dispute.", variant: "destructive" });
    },
  });

  if (authLoading || !user || user.id !== ADMIN_WALLET) return null;

  return (
    <div className="px-6 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-8"
      >
        <Shield className="h-8 w-8 text-red-500" />
        <h1 className="text-3xl font-black tracking-tighter" data-testid="text-admin-title">
          Admin &mdash; Dispute Resolution
        </h1>
      </motion.div>

      {disputesLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
        </div>
      ) : !disputes?.length ? (
        <div className="text-center py-20 border border-dashed rounded-md" data-testid="text-no-disputes">
          <Gavel className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-bold mb-2">No active disputes</h3>
          <p className="text-muted-foreground text-sm">All escrows are running smoothly.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {disputes.map((escrow) => {
              const sharePct = shares[escrow.id] ?? 50;
              return (
                <motion.div
                  key={escrow.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card data-testid={`card-dispute-${escrow.id}`}>
                    <CardHeader className="pb-2 flex-row items-start justify-between gap-2 flex-wrap">
                      <div>
                        <CardTitle className="text-base">Escrow #{escrow.id}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Order #{escrow.orderId} &middot;{" "}
                          {escrow.createdAt ? format(new Date(escrow.createdAt), "PPP") : ""}
                        </p>
                      </div>
                      <Badge className="text-xs capitalize bg-red-500/10 text-red-600">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {escrow.phase.replace("_", " ")}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Depositor</p>
                          <p className="font-mono text-xs truncate">{escrow.depositorId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Receiver</p>
                          <p className="font-mono text-xs truncate">{escrow.receiverId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount</p>
                          <p className="text-lg font-bold font-mono">
                            {escrow.amount}{" "}
                            <span className="text-xs text-muted-foreground font-sans">SOL</span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted p-4 rounded-md space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium">Depositor receives</span>
                          <span className="font-bold font-mono">{sharePct}%</span>
                        </div>
                        <Slider
                          value={[sharePct]}
                          onValueChange={([val]) => setShares((prev) => ({ ...prev, [escrow.id]: val }))}
                          min={0}
                          max={100}
                          step={1}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0% &rarr; All to receiver</span>
                          <span>100% &rarr; All to depositor</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="rounded-full text-xs"
                        disabled={resolveMutation.isPending}
                        onClick={() =>
                          resolveMutation.mutate({
                            escrowId: escrow.id,
                            depositorShareBps: sharePct * 100,
                          })
                        }
                        data-testid={`button-resolve-${escrow.id}`}
                      >
                        {resolveMutation.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Gavel className="mr-1 h-3 w-3" />
                        )}
                        Resolve Dispute
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
