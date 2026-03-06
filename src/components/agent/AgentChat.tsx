"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Trash2 } from "lucide-react";
import { AgentMessage, type AgentChatMessage } from "./AgentMessage";
import { type Service } from "@shared/schema";

interface AgentChatProps {
  listingType: "offer" | "request";
  onPurchase: (service: Service) => void;
  onOpenCreateForm: (listingType: "offer" | "request") => void;
  walletAddress?: string;
  currentUserId?: string;
}

const MAX_HISTORY = 20;

function getStorageKey(walletAddress?: string) {
  return walletAddress ? `wolo_agent_history_${walletAddress}` : null;
}

function loadHistory(walletAddress?: string): AgentChatMessage[] {
  const key = getStorageKey(walletAddress);
  if (!key || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: AgentChatMessage[], walletAddress?: string) {
  const key = getStorageKey(walletAddress);
  if (!key || typeof window === "undefined") return;
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {}
}

export function AgentChat({ listingType, onPurchase, onOpenCreateForm, walletAddress, currentUserId }: AgentChatProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(loadHistory(walletAddress));
  }, [walletAddress]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    const key = getStorageKey(walletAddress);
    if (key && typeof window !== "undefined") localStorage.removeItem(key);
  }, [walletAddress]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: AgentChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    saveHistory(updatedMessages, walletAddress);
    setInput("");
    setIsLoading(true);

    const history = messages.map((m) => ({ role: m.role, text: m.text }));

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, history, listingType }),
      });

      const data = await res.json();

      if (res.ok && data.action?.type === "open_create_form") {
        onOpenCreateForm(data.action.listingType);
      }

      const agentMsg: AgentChatMessage = {
        id: `${Date.now()}-agent`,
        role: "agent",
        text: res.ok ? data.text : (data.error ?? "Something went wrong. Please try again."),
        services: res.ok ? (data.services ?? undefined) : undefined,
        timestamp: Date.now(),
      };

      const withAgent = [...updatedMessages, agentMsg];
      setMessages(withAgent);
      saveHistory(withAgent, walletAddress);
    } catch {
      const errMsg: AgentChatMessage = {
        id: `${Date.now()}-err`,
        role: "agent",
        text: "Connection error. Please try again.",
        timestamp: Date.now(),
      };
      const withErr = [...updatedMessages, errMsg];
      setMessages(withErr);
      saveHistory(withErr, walletAddress);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, listingType, walletAddress]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <p className="text-xs font-medium text-muted-foreground">
          Searching{" "}
          <span className="text-foreground font-semibold">
            {listingType === "offer" ? "offers" : "requests"}
          </span>
        </p>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={clearHistory}
            title="Clear history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-[200px] max-h-[400px]">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
            <p className="text-sm font-medium">Describe what you need</p>
            <p className="text-xs text-muted-foreground max-w-[260px]">
              {listingType === "offer"
                ? "Tell me what content you need and your budget. I'll find the best offers."
                : "Describe your content creation skills and pricing. I'll find matching requests."}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <AgentMessage
            key={msg.id}
            message={msg}
            onPurchase={onPurchase}
            currentUserId={currentUserId}
          />
        ))}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t flex gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you need..."
          className="resize-none text-sm min-h-[38px] max-h-[100px] py-2"
          rows={1}
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
