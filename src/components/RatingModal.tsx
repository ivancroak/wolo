"use client";

import { useState } from "react";
import { useRateOrder } from "@/hooks/use-reputation";
import { useSolanaReputation } from "@/hooks/use-solana-reputation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RatingModalProps {
  orderId: number;
  escrowId?: number;
  targetId: string;
  depositorId?: string;
  targetWalletAddress?: string;
  depositorWalletAddress?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RatingModal({ orderId, escrowId, targetId, depositorId, targetWalletAddress, depositorWalletAddress, open, onOpenChange }: RatingModalProps) {
  const { mutate: rateOrder, isPending } = useRateOrder();
  const solanaRep = useSolanaReputation();
  const { toast } = useToast();
  const [score, setScore] = useState(0);
  const [hoveredScore, setHoveredScore] = useState(0);
  const [comment, setComment] = useState("");

  const handleSubmit = async () => {
    if (score === 0) return;

    if (solanaRep.isReady && escrowId && targetWalletAddress && depositorWalletAddress) {
      try {
        await solanaRep.submitRating(targetWalletAddress, escrowId, score, comment || "", depositorWalletAddress);
      } catch (err: any) {
        console.warn("On-chain rating failed:", err?.message);
        toast({
          title: "On-chain rating skipped",
          description: "Off-chain rating will still be recorded.",
          variant: "destructive",
        });
      }
    }

    rateOrder({ orderId, targetId, score, comment: comment || undefined }, {
      onSuccess: () => {
        onOpenChange(false);
        setScore(0);
        setComment("");
        toast({ title: "Rating Submitted", description: "Thank you for your feedback." });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message || "Failed to submit rating.", variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Rate this transaction</DialogTitle>
          <DialogDescription>How was your experience?</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                onMouseEnter={() => setHoveredScore(n)}
                onMouseLeave={() => setHoveredScore(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star className={`h-8 w-8 ${
                  n <= (hoveredScore || score)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground"
                }`} />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Leave a comment (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending || score === 0}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Rating
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
