import { z } from "zod";
export * from "./models/auth";

export type ServiceCategory = "content" | "space" | "ambassador" | "campaign";
export type ListingType = "offer" | "request";
export type PricingCategory = "fixed" | "payroll";
export type PayrollBasis = "weekly" | "monthly";
export type OrderStatus = "pending" | "completed" | "disputed" | "cancelled";

export type EscrowPhase =
  | "awaiting_deposit"
  | "funded"
  | "in_progress"
  | "under_review"
  | "milestone_check"
  | "released"
  | "refunded"
  | "disputed";

export type MilestoneStatus = "pending" | "submitted" | "approved" | "rejected" | "expired";

export interface Profile {
  id: number;
  userId: string;
  walletAddress: string | null;
  bio: string | null;
  twitterHandle: string | null;
  twitterVerified: boolean;
  isInfluencer: boolean | null;
}

export interface Service {
  id: number;
  creatorId: string;
  title: string;
  description: string;
  price: string;
  category: ServiceCategory;
  listingType: ListingType;
  pricingCategory: PricingCategory;
  payrollBasis: PayrollBasis | null;
  maxActions: number | null;
  deadlineDays: number | null;
  requiredKeyword: string | null;
  minPostCount: number | null;
  postsPerPeriod: number | null;
  imageUrl: string | null;
  active: boolean;
  actionsCompleted: number;
  createdAt: Date | null;
}

export interface Order {
  id: number;
  serviceId: number;
  buyerId: string;
  status: OrderStatus;
  txHash: string | null;
  requirements: string | null;
  escrowId: number | null;
  createdAt: Date | null;
}

export interface Watchlist {
  id: number;
  userId: string;
  watchedUserId: string;
  createdAt: Date | null;
}

export const insertProfileSchema = z.object({
  userId: z.string(),
  walletAddress: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  twitterHandle: z.string().nullable().optional(),
  isInfluencer: z.boolean().nullable().optional(),
});

export const insertServiceSchema = z.object({
  creatorId: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, { message: "Price must be a positive number" }),
  category: z.enum(["content", "space", "ambassador", "campaign"]),
  listingType: z.enum(["offer", "request"]).default("offer"),
  pricingCategory: z.enum(["fixed", "payroll"]),
  payrollBasis: z.enum(["weekly", "monthly"]).nullable().optional(),
  maxActions: z.number().int().min(1).nullable().optional(),
  deadlineDays: z.number().int().min(1).nullable().optional(),
  requiredKeyword: z.string().nullable().optional(),
  minPostCount: z.number().int().min(1).nullable().optional(),
  postsPerPeriod: z.number().int().min(1).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const insertOrderSchema = z.object({
  serviceId: z.number(),
  buyerId: z.string(),
  status: z.enum(["pending", "completed", "disputed", "cancelled"]).optional(),
  txHash: z.string().nullable().optional(),
  requirements: z.string().nullable().optional(),
});

export const insertWatchlistSchema = z.object({
  userId: z.string(),
  watchedUserId: z.string(),
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

export interface Escrow {
  id: number;
  orderId: number;
  depositorId: string;
  receiverId: string;
  amount: string;
  phase: EscrowPhase;
  depositTxHash: string | null;
  releaseTxHash: string | null;
  disputeOpenedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Milestone {
  id: number;
  escrowId: number;
  title: string;
  description: string;
  amount: string;
  targetMetric: number | null;
  deadlineDays: number | null;
  deadlineAt: Date | null;
  status: MilestoneStatus;
  proofUrl: string | null;
  completedAt: Date | null;
}

export interface SecureMessage {
  id: number;
  orderId: number;
  senderId: string;
  recipientId: string;
  ciphertext: string;
  ephemeralPub: string;
  nonce: string;
  createdAt: Date | null;
}

export interface Reputation {
  id: number;
  userId: string;
  ordersCompleted: number;
  ordersDisputed: number;
  totalEarned: string;
  totalSpent: string;
  avgRating: number | null;
  badges: string[];
  updatedAt: Date | null;
}

export interface OrderRating {
  id: number;
  orderId: number;
  raterId: string;
  targetId: string;
  score: number;
  comment: string | null;
  createdAt: Date | null;
}

export const insertEscrowSchema = z.object({
  orderId: z.number(),
  depositorId: z.string(),
  receiverId: z.string(),
  amount: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, { message: "Amount must be a positive number" }),
  expiresInDays: z.number().min(1).max(90).optional(),
});

export const insertMilestoneSchema = z.object({
  escrowId: z.number(),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  amount: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, { message: "Amount must be a positive number" }),
  targetMetric: z.number().nullable().optional(),
  deadlineDays: z.number().nullable().optional(),
});

export const insertSecureMessageSchema = z.object({
  orderId: z.number(),
  recipientId: z.string(),
  ciphertext: z.string(),
  ephemeralPub: z.string(),
  nonce: z.string(),
});

export const insertRatingSchema = z.object({
  orderId: z.number(),
  targetId: z.string(),
  score: z.number().min(1).max(5),
  comment: z.string().nullable().optional(),
});

export type InsertEscrow = z.infer<typeof insertEscrowSchema>;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type InsertSecureMessage = z.infer<typeof insertSecureMessageSchema>;
export type InsertRating = z.infer<typeof insertRatingSchema>;

export type NotificationType =
  | "order_created"
  | "escrow_created"
  | "escrow_funded"
  | "escrow_released"
  | "escrow_disputed"
  | "milestone_submitted"
  | "milestone_approved"
  | "rating_received"
  | "message_received";

export interface Notification {
  id: number;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string | null;
  read: boolean;
  createdAt: Date | null;
}

export type CreateServiceRequest = InsertService;
export type CreateOrderRequest = InsertOrder;
export type UpdateOrderRequest = { status?: OrderStatus; txHash?: string };
