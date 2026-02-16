"use client";

import { useState, useEffect, useRef } from "react";
import { useSecureMessages, useSendSecureMessage } from "@/hooks/use-secure-messages";
import { useChannelKeys } from "@/hooks/use-channel-keys";
import { useAuth } from "@/hooks/use-auth";
import { sealMessage, openMessage } from "@/lib/channel-cipher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Send, KeyRound, Loader2 } from "lucide-react";

interface ChatPanelProps {
  orderId: number;
  recipientId: string;
}

export function ChatPanel({ orderId, recipientId }: ChatPanelProps) {
  const { user } = useAuth();
  const { channelKeys, deriveKeys, hasKeys, isLoading: keysLoading } = useChannelKeys();
  const { data: messages, isLoading: msgsLoading } = useSecureMessages(orderId);
  const { mutate: sendMessage, isPending: sending } = useSendSecureMessage();
  const [text, setText] = useState("");
  const [recipientPubKey, setRecipientPubKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    if (!hasKeys || !recipientId) return;
    fetch(`/api/channel-keys/${recipientId}`, { credentials: "include" })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.publicKey) setRecipientPubKey(data.publicKey); })
      .catch(() => {});
  }, [hasKeys, recipientId]);

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
    if (!text.trim() || !channelKeys || !user || !recipientPubKey) return;
    const envelope = sealMessage(text, recipientPubKey, channelKeys.secretKey);
    sendMessage({
      orderId,
      recipientId,
      ciphertext: envelope.ciphertext,
      ephemeralPub: envelope.ephemeralPub,
      nonce: envelope.nonce,
    }, {
      onSuccess: () => setText(""),
    });
  };

  const decryptedMessages = (messages || []).map((msg: any) => {
    if (!channelKeys) return { ...msg, plaintext: null };
    const plaintext = openMessage(
      { ciphertext: msg.ciphertext, ephemeralPub: msg.ephemeralPub, nonce: msg.nonce },
      channelKeys.secretKey
    );
    return { ...msg, plaintext };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" /> Encrypted Messages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={scrollRef} className="h-48 overflow-y-auto space-y-2 border rounded-md p-3">
          {msgsLoading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
          ) : decryptedMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
          ) : (
            decryptedMessages.map((msg: any) => {
              const isMine = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-3 py-1.5 rounded-lg text-sm ${
                    isMine ? "bg-foreground text-background" : "bg-muted"
                  }`}>
                    {msg.plaintext ?? <span className="italic text-muted-foreground text-xs">Unable to decrypt</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {!recipientPubKey && (
          <p className="text-xs text-amber-500 text-center">Waiting for the other party to unlock their messages...</p>
        )}
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="text-sm"
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !text.trim() || !recipientPubKey}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
