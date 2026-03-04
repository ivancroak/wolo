"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentChat } from "./AgentChat";
import { type Service } from "@shared/schema";

interface AgentPanelProps {
  listingType: "offer" | "request";
  onPurchase: (service: Service) => void;
  onOpenCreateForm: (listingType: "offer" | "request") => void;
  walletAddress?: string;
  currentUserId?: string;
}

export function AgentPanel({ listingType, onPurchase, onOpenCreateForm, walletAddress, currentUserId }: AgentPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen((v) => !v)}
        className="gap-1.5 rounded-full text-xs font-medium h-9 px-3.5 border-primary/40 hover:border-primary/70 self-start"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        AI Search
        {isOpen ? (
          <ChevronUp className="h-3 w-3 ml-0.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 ml-0.5 text-muted-foreground" />
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border bg-background/60 backdrop-blur-sm overflow-hidden shadow-sm">
              <AgentChat
                listingType={listingType}
                onPurchase={onPurchase}
                onOpenCreateForm={onOpenCreateForm}
                walletAddress={walletAddress}
                currentUserId={currentUserId}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
