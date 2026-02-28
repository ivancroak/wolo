"use client";

import type { DealProposal, Service, Order } from "@shared/schema";
import { usePatchProposal } from "@/hooks/use-deal-proposals";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Undo2, Loader2, ArrowRight } from "lucide-react";

interface DealProposalCardProps {
  proposal: DealProposal;
  order: Order;
  service: Service;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  accepted: "bg-green-500/10 text-green-600 border-green-500/30",
  rejected: "bg-red-500/10 text-red-600 border-red-500/30",
  withdrawn: "bg-gray-500/10 text-gray-500 border-gray-500/30",
};

function DiffRow({ label, current, proposed }: { label: string; current: string; proposed: string }) {
  if (current === proposed) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="line-through text-muted-foreground">{current}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="font-medium">{proposed}</span>
    </div>
  );
}

export function DealProposalCard({ proposal, order, service }: DealProposalCardProps) {
  const { user } = useAuth();
  const { mutate: patchProposal, isPending } = usePatchProposal();
  const isProposer = user?.id === proposal.proposerId;
  const isPending_ = proposal.status === "pending";

  const effectivePrice = order.negotiatedPrice ?? service.price;
  const effectiveDeadline = order.negotiatedDeadlineDays ?? service.deadlineDays;
  const effectiveMinPosts = order.negotiatedMinPostCount ?? service.minPostCount;
  const effectivePostsPer = order.negotiatedPostsPerPeriod ?? service.postsPerPeriod;
  const effectiveThreadsPer = order.negotiatedThreadsPerPeriod ?? service.threadsPerPeriod;
  const effectiveContentType = order.negotiatedContentType ?? service.contentType;
  const effectiveKeyword = order.negotiatedRequiredKeyword ?? service.requiredKeyword;

  return (
    <Card className="border-dashed">
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">
            {isProposer ? "You proposed changes" : "Deal proposal received"}
          </span>
          <Badge variant="outline" className={`text-[10px] capitalize ${statusColors[proposal.status] ?? ""}`}>
            {proposal.status}
          </Badge>
        </div>

        <div className="space-y-1">
          {proposal.proposedPrice != null && (
            <DiffRow label="Price" current={`${effectivePrice} SOL`} proposed={`${proposal.proposedPrice} SOL`} />
          )}
          {proposal.proposedDeadlineDays != null && (
            <DiffRow label="Deadline" current={`${effectiveDeadline ?? "—"} days`} proposed={`${proposal.proposedDeadlineDays} days`} />
          )}
          {proposal.proposedMinPostCount != null && (
            <DiffRow label="Min Posts" current={`${effectiveMinPosts ?? "—"}`} proposed={`${proposal.proposedMinPostCount}`} />
          )}
          {proposal.proposedPostsPerPeriod != null && (
            <DiffRow label="Posts/Period" current={`${effectivePostsPer ?? "—"}`} proposed={`${proposal.proposedPostsPerPeriod}`} />
          )}
          {proposal.proposedThreadsPerPeriod != null && (
            <DiffRow label="Threads/Period" current={`${effectiveThreadsPer ?? "—"}`} proposed={`${proposal.proposedThreadsPerPeriod}`} />
          )}
          {proposal.proposedContentType != null && (
            <DiffRow label="Content Type" current={effectiveContentType ?? "—"} proposed={proposal.proposedContentType} />
          )}
          {proposal.proposedRequiredKeyword != null && (
            <DiffRow label="Keyword" current={effectiveKeyword ?? "—"} proposed={proposal.proposedRequiredKeyword} />
          )}
        </div>

        {proposal.message && (
          <p className="text-xs text-muted-foreground italic">&ldquo;{proposal.message}&rdquo;</p>
        )}

        {isPending_ && (
          <div className="flex gap-2 pt-1">
            {isProposer ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-full"
                disabled={isPending}
                onClick={() => patchProposal({ orderId: order.id, proposalId: proposal.id, action: "withdraw" })}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Undo2 className="h-3 w-3 mr-1" />}
                Withdraw
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs rounded-full"
                  disabled={isPending}
                  onClick={() => patchProposal({ orderId: order.id, proposalId: proposal.id, action: "accept" })}
                >
                  {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded-full"
                  disabled={isPending}
                  onClick={() => patchProposal({ orderId: order.id, proposalId: proposal.id, action: "reject" })}
                >
                  {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
                  Decline
                </Button>
              </>
            )}
          </div>
        )}

        {proposal.createdAt && (
          <p className="text-[10px] text-muted-foreground">
            {new Date(proposal.createdAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
