"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSecureMessages, useSendSecureMessage } from "@/hooks/use-secure-messages";
import { useDealProposals } from "@/hooks/use-deal-proposals";
import { useAuth } from "@/hooks/use-auth";
import { DealProposalCard } from "@/components/DealProposalCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, MessageSquare, Maximize2, Minimize2 } from "lucide-react";
import type { Service, Order, DealProposal, EscrowPhase } from "@shared/schema";

interface ChatPanelProps {
  orderId: number;
  recipientId: string;
  service?: Service;
  order?: Order;
  escrowPhase?: EscrowPhase;
}

type TimelineItem =
  | { kind: "message"; id: string; ts: number; data: any }
  | { kind: "proposal"; id: string; ts: number; data: DealProposal };

export function ChatPanel({ orderId, recipientId, service, order, escrowPhase }: ChatPanelProps) {
  const { user } = useAuth();
  const { data: messages, isLoading: msgsLoading } = useSecureMessages(orderId);
  const { data: proposals } = useDealProposals(orderId);
  const { mutate: sendMessage, isPending: sending } = useSendSecureMessage();
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, proposals]);

  const displayMessages = useMemo(() => {
    return (messages || []).map((msg: any) => {
      // Plain text stored directly in ciphertext column
      return { ...msg, plaintext: msg.ciphertext };
    });
  }, [messages]);

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const msg of displayMessages) {
      items.push({
        kind: "message",
        id: `msg-${msg.id}`,
        ts: msg.createdAt ? new Date(msg.createdAt).getTime() : 0,
        data: msg,
      });
    }
    for (const p of (proposals ?? []) as DealProposal[]) {
      items.push({
        kind: "proposal",
        id: `prop-${p.id}`,
        ts: p.createdAt ? new Date(p.createdAt).getTime() : 0,
        data: p,
      });
    }
    items.sort((a, b) => a.ts - b.ts);
    return items;
  }, [displayMessages, proposals]);

  const handleSend = () => {
    if (!text.trim() || !user) return;
    sendMessage({
      orderId,
      content: text.trim(),
    }, { onSuccess: () => setText("") });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" /> Messages
            </CardTitle>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Collapse chat" : "Expand chat"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div ref={scrollRef} className={`${expanded ? "h-[600px]" : "h-[400px]"} overflow-y-auto space-y-2 border rounded-md p-3 transition-[height] duration-200`}>
            {msgsLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
            ) : timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
            ) : (
              timeline.map((item) => {
                if (item.kind === "proposal" && service && order) {
                  return (
                    <div key={item.id} className="my-2">
                      <DealProposalCard
                        proposal={item.data}
                        order={order}
                        service={service}
                      />
                    </div>
                  );
                }
                if (item.kind === "message") {
                  const msg = item.data;
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div key={item.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-3 py-1.5 rounded-lg text-sm ${
                        isMine ? "bg-foreground text-background" : "bg-muted"
                      }`}>
                        {msg.plaintext}
                      </div>
                    </div>
                  );
                }
                return null;
              })
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="text-sm"
            />
            <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
