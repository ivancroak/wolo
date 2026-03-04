"use client";

import { ServiceCard } from "@/components/ServiceCard";
import { CreateServiceModal } from "@/components/CreateServiceModal";
import { PurchaseModal } from "@/components/PurchaseModal";
import { useServices } from "@/hooks/use-services";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useWatchedIds, useToggleWatchlist } from "@/hooks/use-watchlist";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { AgentPanel } from "@/components/agent/AgentPanel";

const categories = [
  { value: "all", label: "All" },
  { value: "content", label: "Content" },
];

const pricingModels = [
  { value: "all", label: "All" },
  { value: "fixed", label: "Fixed" },
  { value: "payroll", label: "Payroll" },
];

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <MarketplaceContent />
    </Suspense>
  );
}

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const creatorFilter = searchParams.get("creator") || undefined;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [pricing, setPricing] = useState<string>("all");
  const [listingType, setListingType] = useState<string>("offer");
  const { data: services, isLoading } = useServices({
    search: search || undefined,
    category: category !== "all" ? category : undefined,
    pricingCategory: pricing !== "all" ? pricing : undefined,
    listingType: listingType,
    creatorId: creatorFilter,
  });
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: watchedIds } = useWatchedIds();
  const { addMutation, removeMutation } = useToggleWatchlist();
  const { toast } = useToast();

  const router = useRouter();
  const [selectedService, setSelectedService] = useState<any>(null);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [agentCreateType, setAgentCreateType] = useState<"offer" | "request" | null>(null);

  const handlePurchase = (service: any) => {
    if (!user) {
      toast({ title: "Wallet not connected", description: "Please connect your wallet to continue.", variant: "destructive" });
      return;
    }
    if (user.id === service.creatorId) {
      router.push("/dashboard");
      return;
    }
    if (!profile?.walletAddress || !profile?.twitterHandle || !profile?.twitterVerified) {
      toast({
        title: "Profile incomplete",
        description: "Set your wallet address and verify your X handle in Profile first.",
        variant: "destructive",
      });
      router.push("/profile");
      return;
    }
    setSelectedService(service);
    setIsPurchaseOpen(true);
  };

  const handleToggleWatch = (creatorId: string, isCurrentlyWatched: boolean) => {
    if (!user) return;
    if (isCurrentlyWatched) {
      removeMutation.mutate(creatorId, {
        onSuccess: () => toast({ title: "Removed from watchlist" }),
      });
    } else {
      addMutation.mutate(creatorId, {
        onSuccess: () => toast({ title: "Added to watchlist" }),
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    }
  };

  return (
    <div className="h-full">
      <div className="px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-8"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-1" data-testid="text-marketplace-title">Marketplace</h1>
            <p className="text-muted-foreground text-sm">Discover and purchase social influence on X.</p>
          </div>
          {user && (
            <div className="flex gap-2">
              <CreateServiceModal listingType="offer" />
              <CreateServiceModal listingType="request" />
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col gap-4 mb-8"
        >
          <div className="flex items-start gap-3 flex-wrap">
            <Tabs value={listingType} onValueChange={setListingType} className="shrink-0">
              <TabsList className="grid grid-cols-2 w-[220px]">
                <TabsTrigger value="offer" data-testid="tab-offers" className="gap-1.5">
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                  Offers
                </TabsTrigger>
                <TabsTrigger value="request" data-testid="tab-requests" className="gap-1.5">
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  Requests
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {user && (
              <AgentPanel
                listingType={listingType as "offer" | "request"}
                onPurchase={handlePurchase}
                onOpenCreateForm={(type) => setAgentCreateType(type)}
                walletAddress={profile?.walletAddress ?? undefined}
                currentUserId={user.id}
              />
            )}
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Service</p>
            <div className="flex gap-1.5 flex-wrap">
              {categories.map((cat) => (
                <Button
                  key={cat.value}
                  variant={category === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(cat.value)}
                  className="rounded-full text-xs font-medium h-7 px-2.5"
                  data-testid={`button-filter-${cat.value}`}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pricing</p>
            <div className="flex gap-1.5 flex-wrap">
              {pricingModels.map((pm) => (
                <Button
                  key={pm.value}
                  variant={pricing === pm.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPricing(pm.value)}
                  className="rounded-full text-xs font-medium h-7 px-2.5"
                  data-testid={`button-filter-pricing-${pm.value}`}
                >
                  {pm.label}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : services?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 border border-dashed rounded-md"
          >
            <h3 className="text-lg font-bold mb-2" data-testid="text-no-services">
              {listingType === "request" ? "No requests found" : "No services found"}
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              {listingType === "request"
                ? "Try adjusting your filters or post the first request."
                : "Try adjusting your filters or create the first listing."}
            </p>
            {user && (
              <CreateServiceModal listingType={listingType as "offer" | "request"} />
            )}
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence mode="popLayout">
              {services?.map((service: any) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onPurchase={handlePurchase}
                  isWatched={watchedIds?.includes(service.creatorId) || false}
                  onToggleWatch={handleToggleWatch}
                  isOwnService={user?.id === service.creatorId}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <PurchaseModal
        service={selectedService}
        open={isPurchaseOpen}
        onOpenChange={setIsPurchaseOpen}
      />
      {agentCreateType && (
        <CreateServiceModal
          listingType={agentCreateType}
          open={true}
          onOpenChange={(open) => { if (!open) setAgentCreateType(null); }}
        />
      )}
    </div>
  );
}
