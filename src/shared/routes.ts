import { z } from 'zod';
import { insertServiceSchema, insertOrderSchema, insertProfileSchema, insertEscrowSchema, insertMilestoneSchema, insertSecureMessageSchema, insertRatingSchema } from './schema';
import type { Service, Order, Profile, Watchlist, Escrow, Milestone, SecureMessage, Reputation, OrderRating, Notification } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  services: {
    list: {
      method: 'GET' as const,
      path: '/api/services' as const,
      input: z.object({
        category: z.enum(["content", "space", "ambassador", "campaign"]).optional(),
        listingType: z.enum(["offer", "request"]).optional(),
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<Service>()),
      },
    },
    myServices: {
      method: 'GET' as const,
      path: '/api/my-services' as const,
      responses: {
        200: z.array(z.custom<Service>()),
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/services/:id' as const,
      responses: {
        200: z.custom<Service>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/services' as const,
      input: insertServiceSchema.omit({ creatorId: true }),
      responses: {
        201: z.custom<Service>(),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
  },
  orders: {
    create: {
      method: 'POST' as const,
      path: '/api/orders' as const,
      input: insertOrderSchema.omit({ buyerId: true }),
      responses: {
        201: z.custom<Order>(),
        401: errorSchemas.unauthorized,
      },
    },
    listMyOrders: {
      method: 'GET' as const,
      path: '/api/my-orders' as const,
      responses: {
        200: z.array(z.custom<Order>()),
        401: errorSchemas.unauthorized,
      },
    },
    listMySales: {
      method: 'GET' as const,
      path: '/api/my-sales' as const,
      responses: {
        200: z.array(z.custom<Order>()),
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/orders/:id' as const,
      input: z.object({
        status: z.enum(["pending", "completed", "disputed", "cancelled"]).optional(),
        txHash: z.string().optional(),
      }),
      responses: {
        200: z.custom<Order>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    }
  },
  profiles: {
    me: {
      method: 'GET' as const,
      path: '/api/profiles/me' as const,
      responses: {
        200: z.custom<Profile>().nullable(),
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/profiles/me' as const,
      input: insertProfileSchema.omit({ userId: true, isInfluencer: true }),
      responses: {
        200: z.custom<Profile>(),
        401: errorSchemas.unauthorized,
      },
    }
  },
  watchlist: {
    list: {
      method: 'GET' as const,
      path: '/api/watchlist' as const,
      responses: {
        200: z.array(z.object({
          watchlistEntry: z.custom<Watchlist>(),
          user: z.object({
            id: z.string(),
            firstName: z.string().nullable(),
            lastName: z.string().nullable(),
            email: z.string().nullable(),
            profileImageUrl: z.string().nullable(),
          }),
          profile: z.custom<Profile>().nullable(),
          serviceCount: z.number(),
        })),
        401: errorSchemas.unauthorized,
      },
    },
    add: {
      method: 'POST' as const,
      path: '/api/watchlist' as const,
      input: z.object({ watchedUserId: z.string() }),
      responses: {
        201: z.custom<Watchlist>(),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
    remove: {
      method: 'DELETE' as const,
      path: '/api/watchlist/:watchedUserId' as const,
      responses: {
        200: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    check: {
      method: 'GET' as const,
      path: '/api/watchlist/check/:userId' as const,
      responses: {
        200: z.object({ isWatching: z.boolean() }),
        401: errorSchemas.unauthorized,
      },
    },
    myWatchedIds: {
      method: 'GET' as const,
      path: '/api/watchlist/ids' as const,
      responses: {
        200: z.array(z.string()),
        401: errorSchemas.unauthorized,
      },
    },
  },
  escrow: {
    create: {
      method: 'POST' as const,
      path: '/api/escrow' as const,
      input: insertEscrowSchema.omit({ depositorId: true }),
      responses: {
        201: z.custom<Escrow>(),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/escrow/:id' as const,
      responses: {
        200: z.object({
          escrow: z.custom<Escrow>(),
          milestones: z.array(z.custom<Milestone>()),
        }),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    getByOrder: {
      method: 'GET' as const,
      path: '/api/orders/:orderId/escrow' as const,
      responses: {
        200: z.object({
          escrow: z.custom<Escrow>(),
          milestones: z.array(z.custom<Milestone>()),
        }),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    updatePhase: {
      method: 'PATCH' as const,
      path: '/api/escrow/:id/phase' as const,
      input: z.object({
        phase: z.enum(["awaiting_deposit", "funded", "in_progress", "under_review", "milestone_check", "released", "refunded", "disputed"]),
        txHash: z.string().optional(),
      }),
      responses: {
        200: z.custom<Escrow>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    myEscrows: {
      method: 'GET' as const,
      path: '/api/my-escrows' as const,
      responses: {
        200: z.array(z.custom<Escrow>()),
        401: errorSchemas.unauthorized,
      },
    },
    addMilestone: {
      method: 'POST' as const,
      path: '/api/escrow/:escrowId/milestones' as const,
      input: insertMilestoneSchema.omit({ escrowId: true }),
      responses: {
        201: z.custom<Milestone>(),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
    updateMilestone: {
      method: 'PATCH' as const,
      path: '/api/milestones/:id' as const,
      input: z.object({
        status: z.enum(["pending", "submitted", "approved", "rejected", "expired"]),
        proofUrl: z.string().optional(),
      }),
      responses: {
        200: z.custom<Milestone>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  messages: {
    send: {
      method: 'POST' as const,
      path: '/api/orders/:orderId/messages' as const,
      input: insertSecureMessageSchema.omit({ orderId: true }),
      responses: {
        201: z.custom<SecureMessage>(),
        401: errorSchemas.unauthorized,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/orders/:orderId/messages' as const,
      responses: {
        200: z.array(z.custom<SecureMessage>()),
        401: errorSchemas.unauthorized,
      },
    },
  },
  reputation: {
    get: {
      method: 'GET' as const,
      path: '/api/reputation/:userId' as const,
      responses: {
        200: z.custom<Reputation>(),
      },
    },
    rate: {
      method: 'POST' as const,
      path: '/api/ratings' as const,
      input: insertRatingSchema,
      responses: {
        201: z.custom<OrderRating>(),
        401: errorSchemas.unauthorized,
      },
    },
    myReputation: {
      method: 'GET' as const,
      path: '/api/my-reputation' as const,
      responses: {
        200: z.custom<Reputation>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  verify: {
    milestone: {
      method: 'GET' as const,
      path: '/api/verify/milestone/:milestoneId' as const,
      input: z.object({
        tweetUrl: z.string().optional(),
        targetHandle: z.string().optional(),
      }).optional(),
      responses: {
        200: z.object({
          status: z.enum(["verified", "not_found", "manual_only", "error"]),
          message: z.string(),
          details: z.record(z.any()).optional(),
        }),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  },
  notifications: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications' as const,
      responses: {
        200: z.array(z.custom<Notification>()),
        401: errorSchemas.unauthorized,
      },
    },
    markRead: {
      method: 'PATCH' as const,
      path: '/api/notifications' as const,
      input: z.object({ ids: z.array(z.number()) }),
      responses: {
        200: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
