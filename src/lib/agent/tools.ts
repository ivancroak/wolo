import type Groq from "groq-sdk";

export const AGENT_TOOLS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_services",
      description:
        "Search the marketplace for services (offers or requests). Always call this before suggesting to create a listing. Call with relaxed=true if strict search returned 0 results.",
      parameters: {
        type: "object" as const,
        properties: {
          listingType: {
            type: "string",
            enum: ["offer", "request"],
            description: "offer = search seller listings; request = search buyer listings",
          },
          contentType: {
            type: "string",
            enum: ["posts", "threads", "mixed"],
            nullable: true,
            description: "Type of content. Mixed is only for payroll services.",
          },
          pricingCategory: {
            type: "string",
            enum: ["fixed", "payroll"],
            nullable: true,
            description: "fixed = one-time contract; payroll = recurring payments",
          },
          payrollBasis: {
            type: "string",
            enum: ["weekly", "monthly"],
            nullable: true,
            description: "Period for payroll pricing.",
          },
          maxPrice: {
            type: "number",
            nullable: true,
            description: "Maximum price in SOL. Hard budget ceiling.",
          },
          minPrice: {
            type: "number",
            nullable: true,
            description: "Minimum price in SOL. Useful for sellers looking for well-paying requests.",
          },
          minPostCount: {
            type: "number",
            nullable: true,
            description: "Minimum number of posts/threads required in the contract.",
          },
          maxDeadlineDays: {
            type: "number",
            nullable: true,
            description: "Maximum deadline in days. Filters out slower services.",
          },
          search: {
            type: "string",
            nullable: true,
            description:
              "Topic keywords extracted from the user's message (e.g. 'crypto DeFi Solana'). Searches title, description, and keywords.",
          },
          sortBy: {
            type: "string",
            enum: ["relevance", "price_asc", "price_desc", "deadline_asc", "volume_desc"],
            nullable: true,
            description:
              "How to rank results. relevance = best match score first (default). price_asc = cheapest first (use when user says 'cheapest', 'affordable', 'budget'). price_desc = most expensive first (use when seller wants highest-paying). deadline_asc = fastest delivery first. volume_desc = most posts/volume first.",
          },
          relaxed: {
            type: "boolean",
            nullable: true,
            description:
              "If true, removes strict filters on contentType, payrollBasis, minPostCount, and deadlineDays. Use ONLY when strict search returned 0 results.",
          },
        },
        required: ["listingType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_marketplace_context",
      description:
        "Get live marketplace statistics: listing counts by type, price ranges, and popular keywords. Call when: user asks about pricing or what's available, before suggesting listing creation to give market-based price guidance, or when the first message is very vague.",
      parameters: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_profile",
      description:
        "Get the current user's profile: twitterVerified status, twitterHandle, and whether wallet is set. In production, check twitterVerified before suggesting offer creation.",
      parameters: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "signal_create_form",
      description:
        "Open the service creation form in the UI. Call ONLY after the user has explicitly confirmed they want to create a listing (said 'yes', 'sure', 'go ahead', etc.). Choose the listingType based on what the user actually needs.",
      parameters: {
        type: "object" as const,
        properties: {
          listingType: {
            type: "string",
            enum: ["offer", "request"],
            description:
              "offer = open the seller service form; request = open the buyer request form. Choose based on what the user needs from the conversation context.",
          },
        },
        required: ["listingType"],
      },
    },
  },
];
