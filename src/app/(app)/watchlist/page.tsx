"use client";

import { useWatchlist, useToggleWatchlist } from "@/hooks/use-watchlist";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Store, Loader2, ArrowUpRight } from "lucide-react";
import { SiX } from "react-icons/si";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";

export default function WatchlistPage() {
  const { user, isLoading: authLoading, isLoggingIn } = useAuth();
  const { data: watchlistItems, isLoading } = useWatchlist();
  const { removeMutation } = useToggleWatchlist();

  if (authLoading || isLoggingIn) {
    return (
      <div className="h-full flex items-center justify-center">
        <Eye className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2" data-testid="text-watchlist-login-prompt">Connect wallet to use Watchlist</h2>
          <p className="text-muted-foreground text-sm mb-6">Track sellers who might offer services you want.</p>
          <ConnectWallet />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-1" data-testid="text-watchlist-title">Watchlist</h1>
          <p className="text-muted-foreground text-sm">People you&apos;re watching for potential services.</p>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !watchlistItems || watchlistItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 border border-dashed rounded-md"
          >
            <Eye className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-lg font-bold mb-2" data-testid="text-no-watchlist">No one on your watchlist</h3>
            <p className="text-muted-foreground text-sm mb-6">Browse the marketplace and watchlist sellers you&apos;re interested in.</p>
            <Link href="/marketplace">
              <Button data-testid="button-browse-marketplace">
                Browse Marketplace
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {watchlistItems.map((item: any) => (
                <motion.div
                  key={item.watchlistEntry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  data-testid={`card-watchlist-${item.user.id}`}
                >
                  <Card className="overflow-visible h-full flex flex-col hover-elevate">
                    <CardContent className="p-5 flex flex-col gap-4 flex-grow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={item.user.profileImageUrl || undefined} alt={item.user.firstName || "User"} />
                            <AvatarFallback className="bg-foreground text-background text-sm font-bold">
                              {(item.user.firstName?.[0] || item.user.id?.[0] || "U").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate font-mono" data-testid={`text-watched-name-${item.user.id}`}>
                              {item.user.id.slice(0, 8)}...{item.user.id.slice(-4)}
                            </p>
                            {item.profile?.twitterHandle && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <SiX className="h-3 w-3" />
                                <span className="truncate">@{item.profile.twitterHandle}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMutation.mutate(item.user.id)}
                          disabled={removeMutation.isPending}
                          data-testid={`button-unwatch-${item.user.id}`}
                        >
                          <EyeOff className="h-4 w-4" />
                        </Button>
                      </div>

                      {item.profile?.bio && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.profile.bio}</p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap mt-auto">
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Store className="h-3 w-3" />
                          {item.serviceCount} {item.serviceCount === 1 ? "service" : "services"}
                        </Badge>
                        {item.profile?.isInfluencer && (
                          <Badge variant="outline" className="text-xs">Influencer</Badge>
                        )}
                      </div>

                      {item.serviceCount > 0 && (
                        <Link href={`/marketplace?creator=${item.user.id}`}>
                          <Button variant="outline" size="sm" className="w-full rounded-full" data-testid={`button-view-services-${item.user.id}`}>
                            View Services
                            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
