export const AGENT_SCHEMA = {
  contentTypes: ["posts", "threads", "mixed"] as const,
  pricingCategories: ["fixed", "payroll"] as const,
  payrollBases: ["weekly", "monthly"] as const,

  fieldDescriptions: {
    listingType: "offer = seller lists a service; request = buyer posts what they need",
    contentType: "posts = single posts on X; threads = multi-post threads; mixed = both (payroll only)",
    pricingCategory: "fixed = one-time contract with deadline; payroll = recurring weekly/monthly payments",
    payrollBasis: "period for payroll: weekly or monthly",
    price: "amount in SOL. For offers: price charged. For requests: buyer budget.",
    minPostCount: "minimum number of posts/threads required (for fixed contracts)",
    postsPerPeriod: "number of posts per payroll period",
    threadsPerPeriod: "number of threads per payroll period",
    deadlineDays: "number of days to complete the contract",
    requiredKeyword: "keyword/topic that must appear in published X posts for automated verification",
    maxActions: "maximum number of buyers who can purchase this offer simultaneously (slots)",
    sortBy: "relevance = score-ranked; price_asc = cheapest first; price_desc = most expensive first; deadline_asc = fastest first; volume_desc = most posts first",
  },
} as const;

export type AgentListingType = "offer" | "request";
export type AgentContentType = "posts" | "threads" | "mixed";
export type AgentPricingCategory = "fixed" | "payroll";
export type AgentPayrollBasis = "weekly" | "monthly";
export type AgentSortBy = "relevance" | "price_asc" | "price_desc" | "deadline_asc" | "volume_desc";

export interface AgentSearchFilters {
  listingType: AgentListingType;
  contentType?: AgentContentType;
  pricingCategory?: AgentPricingCategory;
  payrollBasis?: AgentPayrollBasis;
  maxPrice?: number;
  minPrice?: number;
  minPostCount?: number;
  maxDeadlineDays?: number;
  search?: string;
  creatorHandle?: string;
  sortBy?: AgentSortBy;
  relaxed?: boolean;
}

export interface ToolContext {
  services?: any[];
  action?: { type: "open_create_form"; listingType: AgentListingType };
}
