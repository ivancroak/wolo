"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSecureMessages, useSendSecureMessage } from "@/hooks/use-secure-messages";
import { useDealProposals } from "@/hooks/use-deal-proposals";
import { useChannelKeys } from "@/hooks/use-channel-keys";
import { useAuth } from "@/hooks/use-auth";
import { sealMessage, openMessage } from "@/lib/channel-cipher";
import { DealProposalCard } from "@/components/DealProposalCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Send, KeyRound, Loader2, ShieldOff, Maximize2, Minimize2 } from "lucide-react";
import type { Service, Order, DealProposal, EscrowPhase } from "@shared/schema";

const PLAINTEXT_NONCE = "PLAINTEXT";

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
  const { channelKeys, deriveKeys, hasKeys, isLoading: keysLoading } = useChannelKeys();
  const { data: messages, isLoading: msgsLoading } = useSecureMessages(orderId);
  const { data: proposals } = useDealProposals(orderId);
  const { mutate: sendMessage, isPending: sending } = useSendSecureMessage();
  const [text, setText] = useState("");
  const [recipientPubKey, setRecipientPubKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, proposals]);

  useEffect(() => {
    if (!hasKeys || !recipientId) return;
    fetch(`/api/channel-keys/${recipientId}`, { credentials: "include" })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.publicKey) setRecipientPubKey(data.publicKey); })
      .catch(() => {});
  }, [hasKeys, recipientId]);

  const decryptedMessages = useMemo(() => {
    return (messages || []).map((msg: any) => {
      if (msg.nonce === PLAINTEXT_NONCE) {
        try {
          const plaintext = decodeURIComponent(escape(atob(msg.ciphertext)));
          return { ...msg, plaintext };
        } catch {
          return { ...msg, plaintext: msg.ciphertext };
        }
      }
      if (!channelKeys) return { ...msg, plaintext: null };
      let plaintext = openMessage(
        { ciphertext: msg.ciphertext, ephemeralPub: msg.ephemeralPub, nonce: msg.nonce },
        channelKeys.secretKey
      );
      if (plaintext === null && recipientPubKey && msg.senderId === user?.id) {
        plaintext = openMessage(
          { ciphertext: msg.ciphertext, ephemeralPub: recipientPubKey, nonce: msg.nonce },
          channelKeys.secretKey
        );
      }
      return { ...msg, plaintext };
    });
  }, [messages, channelKeys, recipientPubKey, user?.id]);

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const msg of decryptedMessages) {
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
  }, [decryptedMessages, proposals]);

  if (!hasKeys) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Messages are end-to-end encrypted.</p>
          <Button onClick={deriveKeys} disabled={keysLoading} size="sm" className="rounded-full">
            {keysLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <KeyRound className="mr-2 h-3 w-3" />}
            Unlock Messages
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSend = () => {
    if (!text.trim() || !channelKeys || !user) return;

    if (recipientPubKey) {
      // Fully encrypted message
      const envelope = sealMessage(text, recipientPubKey, channelKeys.secretKey);
      sendMessage({
        orderId,
        recipientId,
        ciphertext: envelope.ciphertext,
        ephemeralPub: envelope.ephemeralPub,
        nonce: envelope.nonce,
      }, { onSuccess: () => setText("") });
    } else {
      // Recipient hasn't unlocked yet — send as plaintext
      // The recipient will see this once they open the chat
      sendMessage({
        orderId,
        recipientId,
        ciphertext: btoa(unescape(encodeURIComponent(text))),
        ephemeralPub: PLAINTEXT_NONCE,
        nonce: PLAINTEXT_NONCE,
      }, { onSuccess: () => setText("") });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" /> Encrypted Messages
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
          <div ref={scrollRef} className={`${expanded ? "h-[500px]" : "h-64"} overflow-y-auto space-y-2 border rounded-md p-3 transition-[height] duration-200`}>
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
                  const isPlaintext = msg.nonce === PLAINTEXT_NONCE;
                  return (
                    <div key={item.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-3 py-1.5 rounded-lg text-sm ${
                        isMine ? "bg-foreground text-background" : "bg-muted"
                      }`}>
                        {msg.plaintext ?? <span className="italic text-muted-foreground text-xs">Unable to decrypt</span>}
                        {isPlaintext && (
                          <span className={`block text-[10px] mt-0.5 ${isMine ? "text-background/50" : "text-muted-foreground"}`}>
                            unencrypted
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })
            )}
          </div>
          {!recipientPubKey && (
            <p className="text-xs text-amber-500 text-center flex items-center justify-center gap-1">
              <ShieldOff className="h-3 w-3" />
              Other party hasn&apos;t unlocked encryption yet — messages are sent unencrypted
            </p>
          )}
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
