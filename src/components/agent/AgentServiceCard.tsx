"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Briefcase, CalendarClock, Clock } from "lucide-react";
import { type Service } from "@shared/schema";

interface AgentServiceCardProps {
  service: Service;
  onPurchase: (service: Service) => void;
  isOwnService?: boolean;
}

export function AgentServiceCard({ service, onPurchase, isOwnService = false }: AgentServiceCardProps) {
  return (
    <div className="rounded-lg border bg-background p-3 flex flex-col gap-2 hover:border-foreground/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{service.title}</p>
          {service.creatorTwitterHandle && (
            <p className="text-xs text-muted-foreground mt-0.5">@{service.creatorTwitterHandle}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold font-mono">{service.price} SOL</p>
          <Badge variant="outline" className="text-[10px] gap-1 mt-0.5">
            {service.pricingCategory === "fixed" ? (
              <Briefcase className="h-2.5 w-2.5" />
            ) : (
              <CalendarClock className="h-2.5 w-2.5" />
            )}
            {service.pricingCategory === "fixed"
              ? "Fixed"
              : `Payroll/${service.payrollBasis ?? ""}`}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="secondary" className="text-[10px] capitalize">
          {service.contentType === "mixed" ? "Posts + Threads" : service.contentType}
        </Badge>
        {service.minPostCount && (
          <span className="text-[10px] text-muted-foreground">{service.minPostCount} posts min</span>
        )}
        {service.postsPerPeriod && (
          <span className="text-[10px] text-muted-foreground">{service.postsPerPeriod}/period</span>
        )}
        {service.deadlineDays && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {service.deadlineDays}d
          </span>
        )}
      </div>

      {!isOwnService && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs rounded-full mt-0.5"
          onClick={() => onPurchase(service)}
        >
          {service.listingType === "request" ? "Fulfill Request" : "Accept Offer"}
          <ArrowUpRight className="ml-1 h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
