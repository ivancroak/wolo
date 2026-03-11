import "server-only";
import {
  type Service,
  type InsertService,
  type Order,
  type InsertOrder,
  type Profile,
  type InsertProfile,
  type Watchlist,
  type UpdateOrderRequest,
  type User,
  type UpsertUser,
  type Escrow,
  type InsertEscrow,
  type EscrowPhase,
  type Milestone,
  type InsertMilestone,
  type MilestoneStatus,
  type SecureMessage,
  type InsertSecureMessage,
  type Reputation,
  type OrderRating,
  type InsertRating,
  type DealProposal,
  type InsertDealProposal,
  type ProposalStatus,
  type PayrollPeriod,
  type PayrollPeriodStatus,
} from "@shared/schema";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getProfile(userId: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: string, profile: Partial<InsertProfile>, internal?: boolean): Promise<Profile>;
  setTwitterVerified(userId: string, verified: boolean): Promise<void>;
  getServices(filters?: { category?: string; pricingCategory?: string; search?: string; listingType?: string; creatorId?: string }): Promise<Service[]>;
  getServicesByCreator(creatorId: string): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, creatorId: string, updates: Partial<InsertService>): Promise<Service>;
  deleteService(id: number, creatorId: string): Promise<void>;
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByBuyer(userId: string): Promise<Order[]>;
  getOrdersBySeller(userId: string): Promise<Order[]>;
  getOrdersByServiceId(serviceId: number): Promise<Order[]>;
  updateOrder(id: number, updates: UpdateOrderRequest): Promise<Order>;
  getWatchlist(userId: string): Promise<any[]>;
  addToWatchlist(userId: string, watchedUserId: string): Promise<Watchlist>;
  removeFromWatchlist(userId: string, watchedUserId: string): Promise<void>;
  isWatching(userId: string, watchedUserId: string): Promise<boolean>;
  getWatchedUserIds(userId: string): Promise<string[]>;
  createEscrow(escrow: InsertEscrow): Promise<Escrow>;
  getEscrow(id: number): Promise<Escrow | undefined>;
  getEscrowByOrder(orderId: number): Promise<Escrow | undefined>;
  updateEscrowPhase(id: number, phase: EscrowPhase, txHash?: string): Promise<Escrow>;
  getEscrowsByUser(userId: string): Promise<Escrow[]>;
  addMilestone(milestone: InsertMilestone): Promise<Milestone>;
  getMilestone(id: number): Promise<Milestone | undefined>;
  getMilestones(escrowId: number): Promise<Milestone[]>;
  updateMilestoneStatus(id: number, status: MilestoneStatus, proofUrl?: string): Promise<Milestone>;
  sendSecureMessage(msg: InsertSecureMessage & { senderId: string }): Promise<SecureMessage>;
  getSecureMessages(orderId: number, userId: string): Promise<SecureMessage[]>;
  getReputation(userId: string): Promise<Reputation>;
  addRating(rating: InsertRating & { raterId: string }): Promise<OrderRating>;
  getRatings(userId: string): Promise<OrderRating[]>;
  getNotifications(userId: string): Promise<any[]>;
  markNotificationsRead(userId: string, ids?: number[]): Promise<void>;
  hasActiveOrder(serviceId: number, buyerId: string): Promise<boolean>;
  cancelPendingApprovalOrders(serviceId: number, exceptOrderId: number): Promise<void>;
  createProposal(proposal: InsertDealProposal & { proposerId: string }): Promise<DealProposal>;
  getProposals(orderId: number): Promise<DealProposal[]>;
  getPendingProposal(orderId: number): Promise<DealProposal | undefined>;
  updateProposalStatus(id: number, status: ProposalStatus): Promise<DealProposal>;
  applyProposalToOrder(orderId: number, proposal: DealProposal): Promise<Order>;
  createPayrollPeriods(escrowId: number, periods: { periodNumber: number; startsAt: Date; endsAt: Date; disputeDeadline: Date; amount: string }[]): Promise<PayrollPeriod[]>;
  getPayrollPeriods(escrowId: number): Promise<PayrollPeriod[]>;
  getPayrollPeriod(id: number): Promise<PayrollPeriod | undefined>;
  updatePayrollPeriodStatus(id: number, status: PayrollPeriodStatus, extra?: { payoutTxHash?: string; disputedBy?: string; disputeReason?: string; resolutionNote?: string }): Promise<PayrollPeriod>;
  getReleasablePayrollPeriods(): Promise<PayrollPeriod[]>;
  getActivatablePayrollPeriods(): Promise<PayrollPeriod[]>;
  updateEscrowPeriodsPaid(escrowId: number, count: number): Promise<void>;
  getExpiredEscrows(): Promise<Escrow[]>;
  fixEscrowParties(escrowId: number, depositorId: string, receiverId: string): Promise<void>;
}

function toUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    profileImageUrl: row.profile_image_url,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toProfile(row: any): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    walletAddress: row.wallet_address,
    bio: row.bio,
    twitterHandle: row.twitter_handle,
    twitterVerified: row.twitter_verified ?? false,
    isInfluencer: row.is_influencer,
    email: row.email ?? null,
    emailVerified: row.email_verified ?? false,
    emailNotifications: row.email_notifications ?? true,
  };
}

function toService(row: any): Service {
  const showHandle = row.show_twitter_handle ?? true;
  const isOffer = row.listing_type === "offer";
  const rawHandle = row._twitter_handle ?? null;
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category,
    listingType: row.listing_type,
    pricingCategory: row.pricing_category,
    payrollBasis: row.payroll_basis,
    contentType: row.content_type ?? "posts",
    maxActions: row.max_actions,
    deadlineDays: row.deadline_days,
    requiredKeyword: row.required_keyword ?? null,
    minPostCount: row.min_post_count ?? null,
    postsPerPeriod: row.posts_per_period ?? null,
    threadsPerPeriod: row.threads_per_period ?? null,
    imageUrl: row.image_url,
    active: row.active,
    actionsCompleted: row.actions_completed ?? 0,
    showTwitterHandle: showHandle,
    creatorTwitterHandle: (isOffer || showHandle) ? rawHandle : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

function toOrder(row: any): Order {
  return {
    id: row.id,
    serviceId: row.service_id,
    buyerId: row.buyer_id,
    status: row.status,
    txHash: row.tx_hash,
    requirements: row.requirements,
    requiredKeyword: row.required_keyword ?? null,
    escrowId: row.escrow_id,
    negotiatedPrice: row.negotiated_price ?? null,
    negotiatedDeadlineDays: row.negotiated_deadline_days ?? null,
    negotiatedMinPostCount: row.negotiated_min_post_count ?? null,
    negotiatedPostsPerPeriod: row.negotiated_posts_per_period ?? null,
    negotiatedThreadsPerPeriod: row.negotiated_threads_per_period ?? null,
    negotiatedContentType: row.negotiated_content_type ?? null,
    negotiatedRequiredKeyword: row.negotiated_required_keyword ?? null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

function toDealProposal(row: any): DealProposal {
  return {
    id: row.id,
    orderId: row.order_id,
    proposerId: row.proposer_id,
    status: row.status,
    proposedPrice: row.proposed_price ?? null,
    proposedDeadlineDays: row.proposed_deadline_days ?? null,
    proposedMinPostCount: row.proposed_min_post_count ?? null,
    proposedPostsPerPeriod: row.proposed_posts_per_period ?? null,
    proposedThreadsPerPeriod: row.proposed_threads_per_period ?? null,
    proposedContentType: row.proposed_content_type ?? null,
    proposedRequiredKeyword: row.proposed_required_keyword ?? null,
    message: row.message ?? null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

function toWatchlist(row: any): Watchlist {
  return {
    id: row.id,
    userId: row.user_id,
    watchedUserId: row.watched_user_id,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

function toEscrow(row: any): Escrow {
  return {
    id: row.id,
    orderId: row.order_id,
    depositorId: row.depositor_id,
    receiverId: row.receiver_id,
    amount: row.amount,
    phase: row.phase,
    depositTxHash: row.deposit_tx_hash,
    releaseTxHash: row.release_tx_hash,
    disputeOpenedAt: row.dispute_opened_at ? new Date(row.dispute_opened_at) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    isRecurring: row.is_recurring ?? false,
    payrollBasis: row.payroll_basis ?? null,
    totalPeriods: row.total_periods ?? null,
    periodsPaid: row.periods_paid ?? 0,
    amountPerPeriod: row.amount_per_period ?? null,
  };
}

function toPayrollPeriod(row: any): PayrollPeriod {
  return {
    id: row.id,
    escrowId: row.escrow_id,
    periodNumber: row.period_number,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    disputeDeadline: new Date(row.dispute_deadline),
    status: row.status,
    amount: row.amount,
    payoutTxHash: row.payout_tx_hash ?? null,
    paidAt: row.paid_at ? new Date(row.paid_at) : null,
    disputedAt: row.disputed_at ? new Date(row.disputed_at) : null,
    disputedBy: row.disputed_by ?? null,
    disputeReason: row.dispute_reason ?? null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
    resolutionNote: row.resolution_note ?? null,
    verificationResult: row.verification_result ?? null,
    matchingPosts: row.matching_posts ?? null,
    requiredPosts: row.required_posts ?? null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

function toMilestone(row: any): Milestone {
  return {
    id: row.id,
    escrowId: row.escrow_id,
    title: row.title,
    description: row.description,
    amount: row.amount,
    targetMetric: row.target_metric,
    deadlineDays: row.deadline_days,
    deadlineAt: row.deadline_at ? new Date(row.deadline_at) : null,
    status: row.status,
    proofUrl: row.proof_url,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

function toSecureMessage(row: any): SecureMessage {
  return {
    id: row.id,
    orderId: row.order_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    ciphertext: row.ciphertext,
    ephemeralPub: row.ephemeral_pub,
    nonce: row.nonce,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

function toReputation(row: any): Reputation {
  return {
    id: row.id,
    userId: row.user_id,
    ordersCompleted: row.orders_completed,
    ordersDisputed: row.orders_disputed,
    totalEarned: row.total_earned,
    totalSpent: row.total_spent,
    avgRating: row.avg_rating ? Number(row.avg_rating) : null,
    badges: row.badges ?? [],
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

function toRating(row: any): OrderRating {
  return {
    id: row.id,
    orderId: row.order_id,
    raterId: row.rater_id,
    targetId: row.target_id,
    score: row.score,
    comment: row.comment,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

class SupabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const { data } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    return data ? toUser(data) : undefined;
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert({
        id: user.id,
        email: user.email ?? null,
        first_name: user.firstName ?? null,
        last_name: user.lastName ?? null,
        profile_image_url: user.profileImageUrl ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toUser(data);
  }

  async getProfile(userId: string): Promise<Profile | undefined> {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    return data ? toProfile(data) : undefined;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const handle = profile.twitterHandle || null;
    if (handle) {
      const { data: dup } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("twitter_handle", handle)
        .neq("user_id", profile.userId)
        .limit(1)
        .maybeSingle();
      if (dup) throw new Error("This X account is already linked to another wallet");
    }
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: profile.userId,
        wallet_address: profile.walletAddress ?? null,
        bio: profile.bio ?? null,
        twitter_handle: handle,
        is_influencer: profile.isInfluencer ?? false,
        email: profile.email ?? null,
        email_notifications: profile.emailNotifications ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toProfile(data);
  }

  async updateProfile(userId: string, profileData: Partial<InsertProfile>, internal = false): Promise<Profile> {
    const existing = await this.getProfile(userId);
    if (!existing) {
      return this.createProfile({ ...profileData, userId } as InsertProfile);
    }
    const updateObj: any = {};
    if (profileData.walletAddress !== undefined) updateObj.wallet_address = profileData.walletAddress;
    if (profileData.bio !== undefined) updateObj.bio = profileData.bio;
    if (profileData.twitterHandle !== undefined) {
      updateObj.twitter_handle = profileData.twitterHandle;
      if (profileData.twitterHandle !== existing.twitterHandle) {
        updateObj.twitter_verified = false;
        if (profileData.twitterHandle) {
          const { data: dup } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .eq("twitter_handle", profileData.twitterHandle)
            .neq("user_id", userId)
            .limit(1)
            .maybeSingle();
          if (dup) throw new Error("This X account is already linked to another wallet");
        }
      }
    }
    if (internal && profileData.isInfluencer !== undefined) updateObj.is_influencer = profileData.isInfluencer;
    if (profileData.email !== undefined) {
      updateObj.email = profileData.email;
      if (profileData.email !== existing.email) {
        updateObj.email_verified = false;
      }
    }
    if (profileData.emailNotifications !== undefined) updateObj.email_notifications = profileData.emailNotifications;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updateObj)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toProfile(data);
  }

  async setTwitterVerified(userId: string, verified: boolean): Promise<void> {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ twitter_verified: verified })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  private async enrichWithHandles(rows: any[]): Promise<any[]> {
    if (rows.length === 0) return rows;
    const ids = Array.from(new Set(rows.map((r: any) => r.creator_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, twitter_handle")
      .in("user_id", ids);
    const handleMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      if (p.twitter_handle) handleMap.set(p.user_id, p.twitter_handle);
    }
    return rows.map((r: any) => ({ ...r, _twitter_handle: handleMap.get(r.creator_id) ?? null }));
  }

  async getServices(filters?: { category?: string; pricingCategory?: string; search?: string; listingType?: string; creatorId?: string }): Promise<Service[]> {
    let query = supabaseAdmin.from("services").select("*").eq("active", true);
    if (filters?.category) query = query.eq("category", filters.category);
    if (filters?.pricingCategory) query = query.eq("pricing_category", filters.pricingCategory);
    if (filters?.listingType) query = query.eq("listing_type", filters.listingType);
    if (filters?.creatorId) query = query.eq("creator_id", filters.creatorId);
    if (filters?.search) {
      const sanitized = filters.search.replace(/[^a-zA-Z0-9\s\-_]/g, '').slice(0, 100);
      if (sanitized.length > 0) {
        query = query.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
      }
    }
    query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const enriched = await this.enrichWithHandles(data ?? []);
    return enriched.map(toService);
  }

  async getServicesByCreator(creatorId: string): Promise<Service[]> {
    const { data, error } = await supabaseAdmin
      .from("services")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const enriched = await this.enrichWithHandles(data ?? []);
    return enriched.map(toService);
  }

  async getService(id: number): Promise<Service | undefined> {
    const { data } = await supabaseAdmin
      .from("services")
      .select("*")
      .eq("id", id)
      .single();
    if (!data) return undefined;
    const enriched = await this.enrichWithHandles([data]);
    return toService(enriched[0]);
  }

  async createService(service: InsertService): Promise<Service> {
    const { data, error } = await supabaseAdmin
      .from("services")
      .insert({
        creator_id: service.creatorId,
        title: service.title,
        description: service.description,
        price: service.price,
        category: service.category,
        listing_type: service.listingType ?? "offer",
        pricing_category: service.pricingCategory,
        payroll_basis: service.pricingCategory === "payroll" ? (service.payrollBasis ?? null) : null,
        content_type: service.contentType ?? "posts",
        max_actions: service.maxActions ?? null,
        deadline_days: service.deadlineDays ?? null,
        required_keyword: service.requiredKeyword ?? null,
        min_post_count: service.minPostCount ?? null,
        posts_per_period: service.postsPerPeriod ?? null,
        threads_per_period: service.threadsPerPeriod ?? null,
        image_url: service.imageUrl ?? null,
        active: service.active ?? true,
        show_twitter_handle: service.showTwitterHandle ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toService(data);
  }

  async updateService(id: number, creatorId: string, updates: Partial<InsertService>): Promise<Service> {
    const updateObj: any = {};
    if (updates.title !== undefined) updateObj.title = updates.title;
    if (updates.description !== undefined) updateObj.description = updates.description;
    if (updates.price !== undefined) updateObj.price = updates.price;
    if (updates.category !== undefined) updateObj.category = updates.category;
    if (updates.pricingCategory !== undefined) updateObj.pricing_category = updates.pricingCategory;
    if (updates.payrollBasis !== undefined) updateObj.payroll_basis = updates.payrollBasis;
    if (updates.contentType !== undefined) updateObj.content_type = updates.contentType;
    if (updates.maxActions !== undefined) updateObj.max_actions = updates.maxActions;
    if (updates.deadlineDays !== undefined) updateObj.deadline_days = updates.deadlineDays;
    if (updates.requiredKeyword !== undefined) updateObj.required_keyword = updates.requiredKeyword;
    if (updates.minPostCount !== undefined) updateObj.min_post_count = updates.minPostCount;
    if (updates.postsPerPeriod !== undefined) updateObj.posts_per_period = updates.postsPerPeriod;
    if (updates.threadsPerPeriod !== undefined) updateObj.threads_per_period = updates.threadsPerPeriod;
    if (updates.imageUrl !== undefined) updateObj.image_url = updates.imageUrl;
    if (updates.active !== undefined) updateObj.active = updates.active;

    const { data, error } = await supabaseAdmin
      .from("services")
      .update(updateObj)
      .eq("id", id)
      .eq("creator_id", creatorId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toService(data);
  }

  async deleteService(id: number, creatorId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("services")
      .update({ active: false })
      .eq("id", id)
      .eq("creator_id", creatorId);
    if (error) throw new Error(error.message);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    // Re-check slot availability right before insert to minimize race window
    const { data: svc } = await supabaseAdmin
      .from("services")
      .select("actions_completed, max_actions")
      .eq("id", order.serviceId)
      .single();

    if (svc?.max_actions != null && (svc.actions_completed ?? 0) >= svc.max_actions) {
      throw new Error("All contracts for this service have been taken");
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .insert({
        service_id: order.serviceId,
        buyer_id: order.buyerId,
        status: order.status ?? "pending",
        tx_hash: order.txHash ?? null,
        requirements: order.requirements ?? null,
        required_keyword: order.requiredKeyword ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.message.includes("uq_orders_service_buyer") || error.message.includes("duplicate key") || error.message.includes("unique")) {
        throw new Error("You already have a contract for this service");
      }
      throw new Error(error.message);
    }

    if (svc) {
      // Atomic increment: only update if count hasn't changed since our read
      const currentCount = svc.actions_completed ?? 0;
      const { error: updateErr } = await supabaseAdmin
        .from("services")
        .update({
          actions_completed: currentCount + 1,
          ...(svc.max_actions != null && currentCount + 1 >= svc.max_actions ? { active: false } : {}),
        })
        .eq("id", order.serviceId)
        .eq("actions_completed", currentCount);

      if (updateErr) {
        // Retry with fresh data using CAS (compare-and-swap)
        const { data: fresh } = await supabaseAdmin
          .from("services")
          .select("actions_completed, max_actions")
          .eq("id", order.serviceId)
          .single();
        if (fresh) {
          const freshCount = fresh.actions_completed ?? 0;
          await supabaseAdmin
            .from("services")
            .update({
              actions_completed: freshCount + 1,
              ...(fresh.max_actions != null && freshCount + 1 >= fresh.max_actions ? { active: false } : {}),
            })
            .eq("id", order.serviceId)
            .eq("actions_completed", freshCount);
        }
      }
    }

    return toOrder(data);
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const { data } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();
    return data ? toOrder(data) : undefined;
  }

  async getOrdersByBuyer(userId: string): Promise<Order[]> {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toOrder);
  }

  async getOrdersBySeller(userId: string): Promise<Order[]> {
    const { data: services } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("creator_id", userId);
    if (!services || services.length === 0) return [];
    const serviceIds = services.map((s: any) => s.id);
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .in("service_id", serviceIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toOrder);
  }

  async getOrdersByServiceId(serviceId: number): Promise<Order[]> {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("service_id", serviceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toOrder);
  }

  async updateOrder(id: number, updates: UpdateOrderRequest): Promise<Order> {
    const updateObj: any = {};
    if (updates.status !== undefined) updateObj.status = updates.status;
    if (updates.txHash !== undefined) updateObj.tx_hash = updates.txHash;
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(updateObj)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toOrder(data);
  }

  async getWatchlist(userId: string): Promise<any[]> {
    const { data: entries, error } = await supabaseAdmin
      .from("watchlist")
      .select("*")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    if (!entries || entries.length === 0) return [];

    const watchedIds = entries.map((e: any) => e.watched_user_id);

    const [usersResult, profilesResult, servicesResult] = await Promise.all([
      supabaseAdmin.from("users").select("*").in("id", watchedIds),
      supabaseAdmin.from("profiles").select("*").in("user_id", watchedIds),
      supabaseAdmin.from("services").select("creator_id").eq("active", true).in("creator_id", watchedIds),
    ]);

    const usersMap = new Map((usersResult.data ?? []).map((u: any) => [u.id, u]));
    const profilesMap = new Map((profilesResult.data ?? []).map((p: any) => [p.user_id, p]));
    const serviceCountMap = new Map<string, number>();
    for (const s of (servicesResult.data ?? [])) {
      serviceCountMap.set(s.creator_id, (serviceCountMap.get(s.creator_id) || 0) + 1);
    }

    return entries.map((entry: any) => {
      const user = usersMap.get(entry.watched_user_id);
      const profile = profilesMap.get(entry.watched_user_id);
      return {
        watchlistEntry: toWatchlist(entry),
        user: user ? {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          profileImageUrl: user.profile_image_url,
        } : null,
        profile: profile ? toProfile(profile) : null,
        serviceCount: serviceCountMap.get(entry.watched_user_id) ?? 0,
      };
    });
  }

  async addToWatchlist(userId: string, watchedUserId: string): Promise<Watchlist> {
    const { data, error } = await supabaseAdmin
      .from("watchlist")
      .insert({ user_id: userId, watched_user_id: watchedUserId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toWatchlist(data);
  }

  async removeFromWatchlist(userId: string, watchedUserId: string): Promise<void> {
    await supabaseAdmin
      .from("watchlist")
      .delete()
      .eq("user_id", userId)
      .eq("watched_user_id", watchedUserId);
  }

  async isWatching(userId: string, watchedUserId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from("watchlist")
      .select("id")
      .eq("user_id", userId)
      .eq("watched_user_id", watchedUserId)
      .single();
    return !!data;
  }

  async getWatchedUserIds(userId: string): Promise<string[]> {
    const { data } = await supabaseAdmin
      .from("watchlist")
      .select("watched_user_id")
      .eq("user_id", userId);
    return (data ?? []).map((d: any) => d.watched_user_id);
  }

  // --- Escrow ---

  async createEscrow(escrowData: InsertEscrow & { isRecurring?: boolean; payrollBasis?: string; totalPeriods?: number; amountPerPeriod?: string }): Promise<Escrow> {
    const now = new Date();
    const insertObj: any = {
      order_id: escrowData.orderId,
      depositor_id: escrowData.depositorId,
      receiver_id: escrowData.receiverId,
      amount: escrowData.amount,
      phase: "awaiting_deposit",
      expires_at: escrowData.expiresInDays
        ? new Date(now.getTime() + escrowData.expiresInDays * 86400000).toISOString()
        : null,
    };
    if (escrowData.isRecurring) {
      insertObj.is_recurring = true;
      insertObj.payroll_basis = escrowData.payrollBasis ?? null;
      insertObj.total_periods = escrowData.totalPeriods ?? null;
      insertObj.amount_per_period = escrowData.amountPerPeriod ?? null;
    }
    const { data, error } = await supabaseAdmin
      .from("escrows")
      .insert(insertObj)
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("orders")
      .update({ escrow_id: data.id })
      .eq("id", escrowData.orderId);

    return toEscrow(data);
  }

  async getEscrow(id: number): Promise<Escrow | undefined> {
    const { data } = await supabaseAdmin
      .from("escrows")
      .select("*")
      .eq("id", id)
      .single();
    return data ? toEscrow(data) : undefined;
  }

  async getEscrowByOrder(orderId: number): Promise<Escrow | undefined> {
    const { data } = await supabaseAdmin
      .from("escrows")
      .select("*")
      .eq("order_id", orderId)
      .single();
    return data ? toEscrow(data) : undefined;
  }

  async updateEscrowPhase(id: number, phase: EscrowPhase, txHash?: string): Promise<Escrow> {
    const updateObj: any = { phase, updated_at: new Date().toISOString() };
    if (phase === "funded" && txHash) updateObj.deposit_tx_hash = txHash;
    if (phase === "released" && txHash) updateObj.release_tx_hash = txHash;
    if (phase === "disputed") updateObj.dispute_opened_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("escrows")
      .update(updateObj)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toEscrow(data);
  }

  async getEscrowsByUser(userId: string): Promise<Escrow[]> {
    const { data, error } = await supabaseAdmin
      .from("escrows")
      .select("*")
      .or(`depositor_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toEscrow);
  }

  // --- Milestones ---

  async addMilestone(milestone: InsertMilestone): Promise<Milestone> {
    const now = new Date();
    const { data, error } = await supabaseAdmin
      .from("milestones")
      .insert({
        escrow_id: milestone.escrowId,
        title: milestone.title,
        description: milestone.description ?? "",
        amount: milestone.amount,
        target_metric: milestone.targetMetric ?? null,
        deadline_days: milestone.deadlineDays ?? null,
        deadline_at: milestone.deadlineDays
          ? new Date(now.getTime() + milestone.deadlineDays * 86400000).toISOString()
          : null,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toMilestone(data);
  }

  async getMilestone(id: number): Promise<Milestone | undefined> {
    const { data } = await supabaseAdmin
      .from("milestones")
      .select("*")
      .eq("id", id)
      .single();
    return data ? toMilestone(data) : undefined;
  }

  async getMilestones(escrowId: number): Promise<Milestone[]> {
    const { data, error } = await supabaseAdmin
      .from("milestones")
      .select("*")
      .eq("escrow_id", escrowId)
      .order("id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toMilestone);
  }

  async updateMilestoneStatus(id: number, status: MilestoneStatus, proofUrl?: string): Promise<Milestone> {
    const updateObj: any = { status };
    if (proofUrl) updateObj.proof_url = proofUrl;
    if (status === "approved") updateObj.completed_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("milestones")
      .update(updateObj)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toMilestone(data);
  }

  // --- Secure Messaging ---

  async sendSecureMessage(msg: InsertSecureMessage & { senderId: string }): Promise<SecureMessage> {
    const { data, error } = await supabaseAdmin
      .from("secure_messages")
      .insert({
        order_id: msg.orderId,
        sender_id: msg.senderId,
        recipient_id: msg.recipientId,
        ciphertext: msg.content,
        ephemeral_pub: "PLAINTEXT",
        nonce: "PLAINTEXT",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toSecureMessage(data);
  }

  async getSecureMessages(orderId: number, userId: string): Promise<SecureMessage[]> {
    const { data, error } = await supabaseAdmin
      .from("secure_messages")
      .select("*")
      .eq("order_id", orderId)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toSecureMessage);
  }

  // --- Reputation & Ratings ---

  async getReputation(userId: string): Promise<Reputation> {
    const { data } = await supabaseAdmin
      .from("reputations")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data) return toReputation(data);

    const { data: created, error } = await supabaseAdmin
      .from("reputations")
      .upsert({
        user_id: userId,
        orders_completed: 0,
        orders_disputed: 0,
        total_earned: "0",
        total_spent: "0",
        avg_rating: null,
        badges: [],
      }, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toReputation(created);
  }

  async addRating(ratingData: InsertRating & { raterId: string }): Promise<OrderRating> {
    const { data, error } = await supabaseAdmin
      .from("ratings")
      .insert({
        order_id: ratingData.orderId,
        rater_id: ratingData.raterId,
        target_id: ratingData.targetId,
        score: ratingData.score,
        comment: ratingData.comment ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { count, data: sumData } = await supabaseAdmin
      .from("ratings")
      .select("score", { count: "exact" })
      .eq("target_id", ratingData.targetId);
    const ratings = sumData ?? [];
    const totalCount = count ?? ratings.length;
    const totalSum = ratings.reduce((sum: number, r: any) => sum + r.score, 0);
    const avgRating = totalCount > 0 ? totalSum / totalCount : null;
    const positiveCount = ratings.filter((r: any) => r.score >= 3).length;
    const badges: string[] = [];
    if (positiveCount >= 1) badges.push("first_deal");
    if (positiveCount >= 5) badges.push("trusted_seller");
    if (positiveCount >= 10) badges.push("top_performer");
    if (avgRating && avgRating >= 4.5 && positiveCount >= 3) badges.push("highly_rated");

    await supabaseAdmin
      .from("reputations")
      .upsert({
        user_id: ratingData.targetId,
        avg_rating: avgRating,
        badges,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    return toRating(data);
  }

  async getRatings(userId: string): Promise<OrderRating[]> {
    const { data, error } = await supabaseAdmin
      .from("ratings")
      .select("*")
      .eq("target_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toRating);
  }


  // --- Notifications ---

  async getNotifications(userId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") {
        return [];
      }
      throw new Error(error.message);
    }
    return (data ?? []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      title: n.title,
      body: n.body,
      linkUrl: n.link_url,
      read: n.read,
      createdAt: n.created_at ? new Date(n.created_at) : null,
    }));
  }

  async markNotificationsRead(userId: string, ids?: number[]): Promise<void> {
    let query = supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId);
    if (ids && ids.length > 0) {
      query = query.in("id", ids);
    }
    const { error } = await query;
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") {
        return;
      }
      throw new Error(error.message);
    }
  }

  async hasActiveOrder(serviceId: number, buyerId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("service_id", serviceId)
      .eq("buyer_id", buyerId)
      .in("status", ["pending_approval", "pending", "completed"])
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  async cancelPendingApprovalOrders(serviceId: number, exceptOrderId: number): Promise<void> {
    await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("service_id", serviceId)
      .eq("status", "pending_approval")
      .neq("id", exceptOrderId);
  }

  // --- Deal Proposals ---

  async createProposal(proposal: InsertDealProposal & { proposerId: string }): Promise<DealProposal> {
    const { data, error } = await supabaseAdmin
      .from("deal_proposals")
      .insert({
        order_id: proposal.orderId,
        proposer_id: proposal.proposerId,
        proposed_price: proposal.proposedPrice ?? null,
        proposed_deadline_days: proposal.proposedDeadlineDays ?? null,
        proposed_min_post_count: proposal.proposedMinPostCount ?? null,
        proposed_posts_per_period: proposal.proposedPostsPerPeriod ?? null,
        proposed_threads_per_period: proposal.proposedThreadsPerPeriod ?? null,
        proposed_content_type: proposal.proposedContentType ?? null,
        proposed_required_keyword: proposal.proposedRequiredKeyword ?? null,
        message: proposal.message ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toDealProposal(data);
  }

  async getProposals(orderId: number): Promise<DealProposal[]> {
    const { data, error } = await supabaseAdmin
      .from("deal_proposals")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toDealProposal);
  }

  async getPendingProposal(orderId: number): Promise<DealProposal | undefined> {
    const { data } = await supabaseAdmin
      .from("deal_proposals")
      .select("*")
      .eq("order_id", orderId)
      .eq("status", "pending")
      .maybeSingle();
    return data ? toDealProposal(data) : undefined;
  }

  async updateProposalStatus(id: number, status: ProposalStatus): Promise<DealProposal> {
    const { data, error } = await supabaseAdmin
      .from("deal_proposals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toDealProposal(data);
  }

  async applyProposalToOrder(orderId: number, proposal: DealProposal): Promise<Order> {
    const updateObj: any = {};
    if (proposal.proposedPrice != null) updateObj.negotiated_price = proposal.proposedPrice;
    if (proposal.proposedDeadlineDays != null) updateObj.negotiated_deadline_days = proposal.proposedDeadlineDays;
    if (proposal.proposedMinPostCount != null) updateObj.negotiated_min_post_count = proposal.proposedMinPostCount;
    if (proposal.proposedPostsPerPeriod != null) updateObj.negotiated_posts_per_period = proposal.proposedPostsPerPeriod;
    if (proposal.proposedThreadsPerPeriod != null) updateObj.negotiated_threads_per_period = proposal.proposedThreadsPerPeriod;
    if (proposal.proposedContentType != null) updateObj.negotiated_content_type = proposal.proposedContentType;
    if (proposal.proposedRequiredKeyword != null) updateObj.negotiated_required_keyword = proposal.proposedRequiredKeyword;

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(updateObj)
      .eq("id", orderId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toOrder(data);
  }

  // --- Payroll Periods ---

  async createPayrollPeriods(escrowId: number, periods: { periodNumber: number; startsAt: Date; endsAt: Date; disputeDeadline: Date; amount: string }[]): Promise<PayrollPeriod[]> {
    const rows = periods.map((p) => ({
      escrow_id: escrowId,
      period_number: p.periodNumber,
      starts_at: p.startsAt.toISOString(),
      ends_at: p.endsAt.toISOString(),
      dispute_deadline: p.disputeDeadline.toISOString(),
      amount: p.amount,
      status: "pending",
    }));
    const { data, error } = await supabaseAdmin
      .from("payroll_periods")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);
    return (data ?? []).map(toPayrollPeriod);
  }

  async getPayrollPeriods(escrowId: number): Promise<PayrollPeriod[]> {
    const { data, error } = await supabaseAdmin
      .from("payroll_periods")
      .select("*")
      .eq("escrow_id", escrowId)
      .order("period_number", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toPayrollPeriod);
  }

  async getPayrollPeriod(id: number): Promise<PayrollPeriod | undefined> {
    const { data } = await supabaseAdmin
      .from("payroll_periods")
      .select("*")
      .eq("id", id)
      .single();
    return data ? toPayrollPeriod(data) : undefined;
  }

  async updatePayrollPeriodStatus(id: number, status: PayrollPeriodStatus, extra?: { payoutTxHash?: string; disputedBy?: string; disputeReason?: string; resolutionNote?: string }): Promise<PayrollPeriod> {
    const updateObj: any = { status };
    if (status === "paid") {
      updateObj.paid_at = new Date().toISOString();
      if (extra?.payoutTxHash) updateObj.payout_tx_hash = extra.payoutTxHash;
    }
    if (status === "disputed") {
      updateObj.disputed_at = new Date().toISOString();
      if (extra?.disputedBy) updateObj.disputed_by = extra.disputedBy;
      if (extra?.disputeReason) updateObj.dispute_reason = extra.disputeReason;
    }
    if (extra?.resolutionNote) {
      updateObj.resolution_note = extra.resolutionNote;
      updateObj.resolved_at = new Date().toISOString();
    }
    const { data, error } = await supabaseAdmin
      .from("payroll_periods")
      .update(updateObj)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toPayrollPeriod(data);
  }

  async getReleasablePayrollPeriods(): Promise<PayrollPeriod[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("payroll_periods")
      .select("*")
      .in("status", ["active", "delivered"])
      .lt("dispute_deadline", now);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toPayrollPeriod);
  }

  async getActivatablePayrollPeriods(): Promise<PayrollPeriod[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("payroll_periods")
      .select("*")
      .eq("status", "pending")
      .lte("starts_at", now);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toPayrollPeriod);
  }

  async updateEscrowPeriodsPaid(escrowId: number, count: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from("escrows")
      .update({ periods_paid: count, updated_at: new Date().toISOString() })
      .eq("id", escrowId);
    if (error) throw new Error(error.message);
  }

  async getExpiredEscrows(): Promise<Escrow[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("escrows")
      .select("*")
      .in("phase", ["funded", "in_progress", "under_review", "milestone_check"])
      .lt("expires_at", now);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toEscrow);
  }

  async fixEscrowParties(escrowId: number, depositorId: string, receiverId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("escrows")
      .update({ depositor_id: depositorId, receiver_id: receiverId, updated_at: new Date().toISOString() })
      .eq("id", escrowId);
    if (error) throw new Error(error.message);
  }
}

export const storage: IStorage = new SupabaseStorage();
