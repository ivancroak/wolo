import { storage } from "@/server/storage";
import type { AgentSearchFilters, AgentSortBy, ToolContext } from "./schema";

const RESULT_LIMIT = 5;

function scoreService(
  service: any,
  filters: AgentSearchFilters
): number {
  let score = 0;
  const price = parseFloat(service.price);

  if (filters.maxPrice !== undefined) {
    const ratio = price / filters.maxPrice;
    score += Math.max(0, (1 - ratio) * 30);
  } else if (filters.minPrice !== undefined) {
    score += Math.min(30, (price / filters.minPrice) * 15);
  }

  if (filters.minPostCount !== undefined && filters.minPostCount > 0) {
    const svc = service.minPostCount ?? service.postsPerPeriod ?? 0;
    if (svc >= filters.minPostCount) {
      score += 15;
      if (svc >= filters.minPostCount * 1.2) score += 5; // bonus: more than requested
    }
  } else if (service.minPostCount || service.postsPerPeriod) {
  }

  if (filters.maxDeadlineDays !== undefined) {
    const dl = service.deadlineDays;
    if (dl != null) {
      if (dl <= filters.maxDeadlineDays) {
        score += 10;
        if (dl <= filters.maxDeadlineDays * 0.7) score += 5; // notably faster
      }
    } else {
      score += 3; // deadline unknown, slight neutral bonus
    }
  }

  if (filters.contentType && service.contentType === filters.contentType) score += 10;
  if (filters.pricingCategory && service.pricingCategory === filters.pricingCategory) score += 5;
  if (filters.payrollBasis && service.payrollBasis === filters.payrollBasis) score += 5;

  return score;
}

function sortAndLimit(services: any[], filters: AgentSearchFilters): any[] {
  const sortBy: AgentSortBy = filters.sortBy ?? "relevance";

  if (sortBy === "price_asc") {
    services.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  } else if (sortBy === "price_desc") {
    services.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  } else if (sortBy === "deadline_asc") {
    services.sort((a, b) => {
      const da = a.deadlineDays ?? Infinity;
      const db = b.deadlineDays ?? Infinity;
      return da - db;
    });
  } else if (sortBy === "volume_desc") {
    services.sort((a, b) => {
      const va = a.minPostCount ?? a.postsPerPeriod ?? 0;
      const vb = b.minPostCount ?? b.postsPerPeriod ?? 0;
      return vb - va;
    });
  } else {
    // relevance: score each and sort DESC
    const scored = services.map((s) => ({ s, score: scoreService(s, filters) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, RESULT_LIMIT).map((x) => x.s);
  }

  return services.slice(0, RESULT_LIMIT);
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<{ result: string; context: ToolContext }> {
  switch (toolName) {
    case "search_services": {
      // Strip null values the LLM may pass for optional fields
      const rawArgs = args as Record<string, unknown>;
      for (const key of Object.keys(rawArgs)) {
        if (rawArgs[key] === null) delete rawArgs[key];
      }
      const filters = rawArgs as unknown as AgentSearchFilters;

      let services = await storage.getServices({
        category: "content",
        listingType: filters.listingType,
        pricingCategory: filters.pricingCategory,
        search: filters.search,
      });

      // Always exclude own services
      services = services.filter((s) => s.creatorId !== userId);

      // Filter by creator handle (post-filter, handle already enriched)
      if (filters.creatorHandle) {
        const h = filters.creatorHandle.replace(/^@/, "").toLowerCase();
        services = services.filter((s) =>
          s.creatorTwitterHandle?.toLowerCase().includes(h)
        );
      }

      // Hard filters (never relaxed)
      if (filters.maxPrice !== undefined) {
        services = services.filter((s) => parseFloat(s.price) <= filters.maxPrice!);
      }
      if (filters.minPrice !== undefined) {
        services = services.filter((s) => parseFloat(s.price) >= filters.minPrice!);
      }
      services = services.filter(
        (s) => s.maxActions == null || s.actionsCompleted < s.maxActions
      );

      // Soft filters (removed when relaxed=true)
      if (!filters.relaxed) {
        if (filters.contentType) {
          services = services.filter((s) => s.contentType === filters.contentType);
        }
        if (filters.payrollBasis) {
          services = services.filter((s) => s.payrollBasis === filters.payrollBasis);
        }
        if (filters.minPostCount !== undefined) {
          services = services.filter(
            (s) => s.minPostCount == null || s.minPostCount >= filters.minPostCount!
          );
        }
        if (filters.maxDeadlineDays !== undefined) {
          services = services.filter(
            (s) => s.deadlineDays == null || s.deadlineDays <= filters.maxDeadlineDays!
          );
        }
      }

      const ranked = sortAndLimit(services, filters);

      const summary = ranked.map((s) => ({
        id: s.id,
        title: s.title,
        price: s.price,
        contentType: s.contentType,
        pricingCategory: s.pricingCategory,
        payrollBasis: s.payrollBasis,
        minPostCount: s.minPostCount,
        postsPerPeriod: s.postsPerPeriod,
        threadsPerPeriod: s.threadsPerPeriod,
        deadlineDays: s.deadlineDays,
        creatorHandle: s.creatorTwitterHandle,
        requiredKeyword: s.requiredKeyword,
      }));

      return {
        result: `Found ${services.length} matching service(s), showing top ${ranked.length}: ${JSON.stringify(summary)}`,
        context: { services: ranked },
      };
    }

    case "get_marketplace_context": {
      const [allOffers, allRequests] = await Promise.all([
        storage.getServices({ category: "content", listingType: "offer" }),
        storage.getServices({ category: "content", listingType: "request" }),
      ]);

      const offerPrices = allOffers.map((s) => parseFloat(s.price)).filter((p) => !isNaN(p));
      const requestPrices = allRequests.map((s) => parseFloat(s.price)).filter((p) => !isNaN(p));

      const avg = (arr: number[]) =>
        arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : "0";

      const countByType = (list: any[]) => {
        const counts: Record<string, number> = {};
        for (const s of list) counts[s.contentType] = (counts[s.contentType] || 0) + 1;
        return counts;
      };

      const keywords = [...allOffers, ...allRequests]
        .map((s) => s.requiredKeyword)
        .filter(Boolean)
        .slice(0, 20);

      const ctx = {
        offers: { total: allOffers.length, byContentType: countByType(allOffers) },
        requests: { total: allRequests.length, byContentType: countByType(allRequests) },
        priceRange: {
          offerMin: offerPrices.length ? Math.min(...offerPrices).toFixed(3) : "0",
          offerMax: offerPrices.length ? Math.max(...offerPrices).toFixed(3) : "0",
          offerAvg: avg(offerPrices),
          requestMin: requestPrices.length ? Math.min(...requestPrices).toFixed(3) : "0",
          requestMax: requestPrices.length ? Math.max(...requestPrices).toFixed(3) : "0",
          requestAvg: avg(requestPrices),
        },
        popularKeywords: Array.from(new Set(keywords)).slice(0, 8),
      };

      return {
        result: JSON.stringify(ctx),
        context: {},
      };
    }

    case "get_user_profile": {
      const profile = await storage.getProfile(userId);
      return {
        result: `Profile: twitterVerified=${profile?.twitterVerified ?? false}, twitterHandle=${profile?.twitterHandle ?? "none"}, walletAddress=${profile?.walletAddress ? "set" : "not set"}`,
        context: {},
      };
    }

    case "signal_create_form": {
      const listingType = (args.listingType as "offer" | "request") ?? "offer";
      return {
        result: `Opening the ${listingType} creation form for the user.`,
        context: { action: { type: "open_create_form", listingType } },
      };
    }

    default:
      return { result: `Unknown tool: ${toolName}`, context: {} };
  }
}
