"use client";

import { useState } from "react";
import type { Service, Order, EscrowPhase } from "@shared/schema";
import { useCreateProposal } from "@/hooks/use-deal-proposals";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProposeChangesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  service: Service;
  escrowPhase?: EscrowPhase;
}

export function ProposeChangesModal({
  open,
  onOpenChange,
  order,
  service,
  escrowPhase,
}: ProposeChangesModalProps) {
  const { mutate: createProposal, isPending } = useCreateProposal();
  const { toast } = useToast();

  const effectivePrice = order.negotiatedPrice ?? service.price;
  const effectiveDeadline = order.negotiatedDeadlineDays ?? service.deadlineDays;
  const effectiveMinPosts = order.negotiatedMinPostCount ?? service.minPostCount;
  const effectivePostsPer = order.negotiatedPostsPerPeriod ?? service.postsPerPeriod;
  const effectiveThreadsPer = order.negotiatedThreadsPerPeriod ?? service.threadsPerPeriod;
  const effectiveContentType = order.negotiatedContentType ?? service.contentType;
  const effectiveKeyword = order.negotiatedRequiredKeyword ?? service.requiredKeyword;

  const [price, setPrice] = useState(effectivePrice);
  const [deadlineDays, setDeadlineDays] = useState(effectiveDeadline?.toString() ?? "");
  const [minPosts, setMinPosts] = useState(effectiveMinPosts?.toString() ?? "");
  const [postsPer, setPostsPer] = useState(effectivePostsPer?.toString() ?? "");
  const [threadsPer, setThreadsPer] = useState(effectiveThreadsPer?.toString() ?? "");
  const [contentType, setContentType] = useState<"posts" | "threads" | "mixed">(effectiveContentType ?? "posts");
  const [keyword, setKeyword] = useState(effectiveKeyword ?? "");
  const [message, setMessage] = useState("");

  const escrowFunded = escrowPhase != null && escrowPhase !== "awaiting_deposit";

  const hasChanges = () => {
    if (price !== effectivePrice) return true;
    if (deadlineDays !== (effectiveDeadline?.toString() ?? "")) return true;
    if (minPosts !== (effectiveMinPosts?.toString() ?? "")) return true;
    if (postsPer !== (effectivePostsPer?.toString() ?? "")) return true;
    if (threadsPer !== (effectiveThreadsPer?.toString() ?? "")) return true;
    if (contentType !== (effectiveContentType ?? "posts")) return true;
    if (keyword !== (effectiveKeyword ?? "")) return true;
    return false;
  };

  const handleSubmit = () => {
    const payload: any = { orderId: order.id };

    if (price !== effectivePrice) payload.proposedPrice = price;
    if (deadlineDays !== (effectiveDeadline?.toString() ?? "")) payload.proposedDeadlineDays = Number(deadlineDays) || null;
    if (minPosts !== (effectiveMinPosts?.toString() ?? "")) payload.proposedMinPostCount = Number(minPosts) || null;
    if (postsPer !== (effectivePostsPer?.toString() ?? "")) payload.proposedPostsPerPeriod = Number(postsPer) || null;
    if (threadsPer !== (effectiveThreadsPer?.toString() ?? "")) payload.proposedThreadsPerPeriod = Number(threadsPer) || null;
    if (contentType !== (effectiveContentType ?? "posts")) payload.proposedContentType = contentType;
    if (keyword !== (effectiveKeyword ?? "")) payload.proposedRequiredKeyword = keyword || null;
    if (message.trim()) payload.message = message.trim();

    createProposal(payload, {
      onSuccess: () => {
        toast({ title: "Proposal Sent", description: "Your proposal has been submitted." });
        onOpenChange(false);
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Propose Deal Changes</DialogTitle>
          <DialogDescription>
            Modify terms below. Only changed fields will be proposed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Price (SOL)</Label>
            <Input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 0.5"
            />
            {escrowFunded && (
              <p className="text-[10px] text-muted-foreground">Changing the price will require the depositor to adjust escrow funds.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Deadline (days)</Label>
              <Input
                type="number"
                value={deadlineDays}
                onChange={(e) => setDeadlineDays(e.target.value)}
                placeholder="—"
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min Posts</Label>
              <Input
                type="number"
                value={minPosts}
                onChange={(e) => setMinPosts(e.target.value)}
                placeholder="—"
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Posts / Period</Label>
              <Input
                type="number"
                value={postsPer}
                onChange={(e) => setPostsPer(e.target.value)}
                placeholder="—"
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Threads / Period</Label>
              <Input
                type="number"
                value={threadsPer}
                onChange={(e) => setThreadsPer(e.target.value)}
                placeholder="—"
                min={1}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Content Type</Label>
            <Select value={contentType} onValueChange={(v) => setContentType(v as "posts" | "threads" | "mixed")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="posts">Posts</SelectItem>
                <SelectItem value="threads">Threads</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Required Keyword</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. #myproject"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Message (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain why you'd like these changes..."
              className="min-h-[60px]"
              maxLength={500}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !hasChanges()}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Proposal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
