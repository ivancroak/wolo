"use client";

import { AgentServiceCard } from "./AgentServiceCard";
import { type Service } from "@shared/schema";

export interface AgentChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  services?: Service[];
  timestamp: number;
}

interface AgentMessageProps {
  message: AgentChatMessage;
  onPurchase: (service: Service) => void;
  currentUserId?: string;
}

export function AgentMessage({ message, onPurchase, currentUserId }: AgentMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-foreground text-background rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {message.text}
      </div>

      {!isUser && message.services && message.services.length > 0 && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          {message.services.map((service) => (
            <AgentServiceCard
              key={service.id}
              service={service}
              onPurchase={onPurchase}
              isOwnService={service.creatorId === currentUserId}
            />
          ))}
        </div>
      )}

    </div>
  );
}
