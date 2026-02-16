"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heart, Repeat, UserPlus, Users, Sparkles, ArrowUpRight, Eye, EyeOff, DollarSign, Briefcase, CalendarClock, ShieldCheck, Clock } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface ServiceCardProps {
  service: any;
  onPurchase: (service: any) => void;
  isWatched?: boolean;
  onToggleWatch?: (creatorId: string, isCurrentlyWatched: boolean) => void;
  isOwnService?: boolean;
}

export function ServiceCard({ service, onPurchase, isWatched = false, onToggleWatch, isOwnService = false }: ServiceCardProps) {
  const getIcon = (category: string) => {
    switch (category) {
      case "repost": return <Repeat className="h-3.5 w-3.5" />;
      case "like": return <Heart className="h-3.5 w-3.5" />;
      case "follow": return <UserPlus className="h-3.5 w-3.5" />;
      case "ambassador": return <Users className="h-3.5 w-3.5" />;
      default: return <Sparkles className="h-3.5 w-3.5" />;
    }
  };

  const getPricingLabel = (pricingCategory: string, payrollBasis: string | null) => {
    switch (pricingCategory) {
      case "pay_per_action": return "Per Action";
      case "full_service": return "Full Service";
      case "payroll": return payrollBasis ? `Payroll / ${payrollBasis.charAt(0).toUpperCase() + payrollBasis.slice(1)}` : "Payroll";
      default: return pricingCategory;
    }
  };

  const getPricingIcon = (pricingCategory: string) => {
    switch (pricingCategory) {
      case "pay_per_action": return <DollarSign className="h-3 w-3" />;
      case "full_service": return <Briefcase className="h-3 w-3" />;
      case "payroll": return <CalendarClock className="h-3 w-3" />;
      default: return <DollarSign className="h-3 w-3" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      data-testid={`card-service-${service.id}`}
    >
      <Card className="overflow-visible h-full flex flex-col group hover-elevate">
        <CardHeader className="pb-3 flex-row items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <Link href={`/services/${service.id}`}>
              <h3 className="text-base font-bold tracking-tight line-clamp-1 group-hover:text-foreground transition-colors hover:underline" data-testid={`text-service-title-${service.id}`}>
                {service.title}
              </h3>
            </Link>
            <div className="flex items-center gap-2 mt-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px] bg-foreground text-background font-bold">
                  {service.creatorId.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground font-mono">{service.creatorId.slice(0, 8)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onToggleWatch && !isOwnService && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatch(service.creatorId, isWatched);
                    }}
                    className={isWatched ? "text-foreground" : "text-muted-foreground"}
                    data-testid={`button-watch-${service.id}`}
                  >
                    {isWatched ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isWatched ? "Remove from watchlist" : "Add seller to watchlist"}
                </TooltipContent>
              </Tooltip>
            )}
            {service.listingType === "request" && (
              <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600" data-testid={`badge-listing-type-${service.id}`}>
                Request
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1 text-xs" data-testid={`badge-category-${service.id}`}>
              {getIcon(service.category)}
              <span className="capitalize">{service.category}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-grow pb-3">
          <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed" data-testid={`text-service-desc-${service.id}`}>
            {service.description}
          </p>
        </CardContent>

        <CardFooter className="pt-3 border-t flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{service.listingType === "request" ? "Budget" : "Price"}</span>
            <p className="text-lg font-bold font-mono tracking-tight" data-testid={`text-price-${service.id}`}>{service.price} <span className="text-xs text-muted-foreground font-sans">SOL</span></p>
            {service.pricingCategory && (
              <Badge variant="outline" className="gap-1 text-[10px] mt-1" data-testid={`badge-pricing-${service.id}`}>
                {getPricingIcon(service.pricingCategory)}
                {getPricingLabel(service.pricingCategory, service.payrollBasis)}
              </Badge>
            )}
            {service.pricingCategory === "pay_per_action" && (service.maxActions || service.budgetCap) && (
              <div className="flex items-center gap-1 mt-1">
                <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  {service.maxActions && `${service.maxActions} actions`}
                  {service.maxActions && service.budgetCap && " / "}
                  {service.budgetCap && `${service.budgetCap} SOL cap`}
                </span>
              </div>
            )}
            {service.listingType === "request" && service.deadlineDays && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  {service.deadlineDays} day{service.deadlineDays !== 1 ? "s" : ""} deadline
                </span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => onPurchase(service)}
            className="rounded-full"
            data-testid={`button-purchase-${service.id}`}
          >
            {service.listingType === "request" ? "Fulfill" : "Purchase"}
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
