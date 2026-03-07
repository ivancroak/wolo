"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyOrders, useMySales, useUpdateOrder } from "@/hooks/use-orders";
import { useMyServices } from "@/hooks/use-services";
import { useMyReputation } from "@/hooks/use-reputation";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Package, TrendingUp, CheckCircle, XCircle, LayoutList, Shield, Star, Award, MessageSquare, ArrowLeft, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useNotifications, useMarkRead } from "@/hooks/use-notifications";
import { useMyConversations, type Conversation } from "@/hooks/use-conversations";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { motion, AnimatePresence } from "framer-motion";
import { ChatPanel } from "@/components/ChatPanel";
import { type Order, type Service } from "@shared/schema";

export default function DashboardPage() {
  const { user, isLoading: authLoading, isLoggingIn } = useAuth();
  const { data: orders, isLoading: ordersLoading } = useMyOrders();
  const { data: sales, isLoading: salesLoading } = useMySales();
  const { data: myServices, isLoading: servicesLoading } = useMyServices();
  const { data: reputation } = useMyReputation();
  const { mutate: updateOrder } = useUpdateOrder();
  const { toast } = useToast();
  const { data: conversations, isLoading: convsLoading } = useMyConversations();
  const { data: notifications } = useNotifications();
  const { mutate: markRead } = useMarkRead();
  const [openChat, setOpenChat] = useState<number | null>(null);

  const unreadByOrderId = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const n of notifications ?? []) {
      if (n.type !== "message_received" || n.read) continue;
      const match = n.linkUrl?.match(/\/orders\/(\d+)/);
      if (!match) continue;
      const orderId = Number(match[1]);
      const arr = map.get(orderId) ?? [];
      arr.push(n.id);
      map.set(orderId, arr);
    }
    return map;
  }, [notifications]);

  const unreadMessageCount = useMemo(() => {
    let count = 0;
    unreadByOrderId.forEach((ids) => { count += ids.length; });
    return count;
  }, [unreadByOrderId]);

  useEffect(() => {
    if (openChat === null) return;
    const ids = unreadByOrderId.get(openChat);
    if (ids?.length) markRead(ids);
  }, [openChat, unreadByOrderId, markRead]);

  const handleStatusUpdate = (orderId: number, status: "completed" | "cancelled") => {
    updateOrder({ id: orderId, status }, {
      onSuccess: () => {
        toast({ title: "Order Updated", description: `Order marked as ${status}.` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update order.", variant: "destructive" });
      }
    });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const variant = status === "completed" ? "default" : status === "cancelled" ? "destructive" : "secondary";
    return <Badge variant={variant === "default" ? "default" : variant === "destructive" ? "destructive" : "secondary"} className="text-xs capitalize" data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  if (authLoading || isLoggingIn) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <LayoutList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2">Connect wallet to view Dashboard</h2>
          <p className="text-muted-foreground text-sm mb-6">Manage your orders and services.</p>
          <ConnectWallet />
        </div>
      </div>
    );
  }

  const OrderCard = ({ order, isSeller }: { order: Order; isSeller?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card data-testid={`card-order-${order.id}`}>
        <CardHeader className="pb-2 flex-row items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">Order #{order.id}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {order.createdAt ? format(new Date(order.createdAt), "PPP") : ""}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </CardHeader>
        <CardContent className="space-y-3">
          {order.requirements && (
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="font-medium mb-1 text-muted-foreground text-xs uppercase tracking-wider">Requirements</p>
              <p className="text-foreground">{order.requirements}</p>
            </div>
          )}
          <div className="flex justify-between items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <Link href={`/orders/${order.id}`} className="font-mono text-xs hover:underline">
              Order #{order.id} &middot; Service #{order.serviceId}
            </Link>
            {isSeller && order.status === "pending" && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => handleStatusUpdate(order.id, "cancelled")}
                  data-testid={`button-cancel-${order.id}`}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => handleStatusUpdate(order.id, "completed")}
                  data-testid={`button-complete-${order.id}`}
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Complete
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="px-6 py-6">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-black tracking-tighter mb-8"
        data-testid="text-dashboard-title"
      >
        Dashboard
      </motion.h1>

      {reputation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Star className="mx-auto h-5 w-5 text-amber-500 mb-1" />
              <p className="text-2xl font-bold font-mono">{reputation.avgRating?.toFixed(1) ?? "--"}</p>
              <p className="text-xs text-muted-foreground">Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <CheckCircle className="mx-auto h-5 w-5 text-green-500 mb-1" />
              <p className="text-2xl font-bold font-mono">{reputation.ordersCompleted}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Shield className="mx-auto h-5 w-5 text-blue-500 mb-1" />
              <p className="text-2xl font-bold font-mono">{(orders?.length ?? 0) + (sales?.length ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Award className="mx-auto h-5 w-5 text-purple-500 mb-1" />
              <div className="flex gap-1 justify-center flex-wrap mt-1">
                {reputation.badges?.length > 0 ? reputation.badges.map((b: string) => (
                  <Badge key={b} variant="secondary" className="text-[10px]">{b.replace(/_/g, " ")}</Badge>
                )) : <span className="text-xs text-muted-foreground">None yet</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Badges</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="mb-8 w-full max-w-md grid grid-cols-2">
          <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-chat" className="relative" onClick={() => setOpenChat(null)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Chat
            {unreadMessageCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadMessageCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <div className="space-y-8">
            {/* My Listings */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <LayoutList className="h-4 w-4" /> My Listings
              </h3>
              {servicesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
              ) : !myServices?.length ? (
                <p className="text-sm text-muted-foreground py-4">No listings yet. Head to the marketplace to list a service or post a request.</p>
              ) : (
                <div className="grid gap-3">
                  {myServices.map((service: Service) => (
                    <Link key={service.id} href={`/services/${service.id}`} className="block">
                      <Card className="hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`card-listing-${service.id}`}>
                        <CardContent className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{service.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {service.listingType === "request" ? "Request" : "Offer"} &middot; {service.price} SOL
                              {service.createdAt ? ` &middot; ${format(new Date(service.createdAt), "MMM d")}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`h-2 w-2 rounded-full ${service.active ? "bg-green-500" : "bg-red-400"}`} />
                            <Badge variant="secondary" className="text-[10px]">{service.active ? "Active" : "Inactive"}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Buying Orders */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Package className="h-4 w-4" /> Buying
              </h3>
              {ordersLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
              ) : !orders?.length ? (
                <p className="text-sm text-muted-foreground py-4">No purchases yet. Browse the marketplace to find services.</p>
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence>
                    {orders.map((order: Order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Selling Orders */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Selling
              </h3>
              {salesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
              ) : !sales?.length ? (
                <p className="text-sm text-muted-foreground py-4">No sales yet. List a service to start earning SOL.</p>
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence>
                    {sales.map((order: Order) => (
                      <OrderCard key={order.id} order={order} isSeller />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="chat">
          {convsLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : openChat !== null ? (() => {
            const conv = conversations?.find((c: Conversation) => c.orderId === openChat);
            if (!conv) return null;
            return (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setOpenChat(null)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <div>
                    <p className="text-sm font-medium">{conv.serviceTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {conv.counterpartyHandle ? `@${conv.counterpartyHandle}` : conv.counterpartyId.slice(0, 8) + "..."}
                      {" "}&middot; You are the {conv.role}
                    </p>
                  </div>
                </div>
                <ChatPanel orderId={openChat} recipientId={conv.counterpartyId} />
              </motion.div>
            );
          })() : !conversations?.length ? (
            <div className="text-center py-20 border border-dashed rounded-md" data-testid="text-no-conversations">
              <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold mb-2">No conversations yet</h3>
              <p className="text-muted-foreground text-sm">Conversations appear here when you buy or sell a service.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              <AnimatePresence>
                {conversations.map((conv: Conversation) => {
                  const unreadIds = unreadByOrderId.get(conv.orderId);
                  const unreadCount = unreadIds?.length ?? 0;
                  return (
                    <motion.div
                      key={conv.orderId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${unreadCount > 0 ? "border-red-500/40" : ""}`}
                        onClick={() => setOpenChat(conv.orderId)}
                        data-testid={`card-conversation-${conv.orderId}`}
                      >
                        <CardContent className="py-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{conv.serviceTitle}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {conv.counterpartyHandle ? `@${conv.counterpartyHandle}` : conv.counterpartyId.slice(0, 8) + "..."}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-[10px] capitalize">{conv.role}</Badge>
                            <StatusBadge status={conv.orderStatus} />
                            {unreadCount > 0 && (
                              <span className="h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                            <Link
                              href={`/orders/${conv.orderId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                              title="Open order"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
