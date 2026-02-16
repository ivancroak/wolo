"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

type CreateServiceInput = z.infer<typeof api.services.create.input>;

export function useServices(filters?: { category?: string; search?: string; listingType?: string }) {
  const validCategory = filters?.category &&
    ["repost", "like", "follow", "ambassador", "custom"].includes(filters.category)
    ? (filters.category as "repost" | "like" | "follow" | "ambassador" | "custom")
    : undefined;

  const validListingType = filters?.listingType &&
    ["offer", "request"].includes(filters.listingType)
    ? filters.listingType
    : undefined;

  const queryKey = [api.services.list.path, filters?.category, filters?.search, filters?.listingType];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = filters
        ? `${api.services.list.path}?${new URLSearchParams({
            ...(validCategory ? { category: validCategory } : {}),
            ...(validListingType ? { listingType: validListingType } : {}),
            ...(filters.search ? { search: filters.search } : {}),
          }).toString()}`
        : api.services.list.path;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch services");
      return api.services.list.responses[200].parse(await res.json());
    },
  });
}

export function useMyServices() {
  return useQuery({
    queryKey: [api.services.myServices.path],
    queryFn: async () => {
      const res = await fetch(api.services.myServices.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to fetch my services");
      }
      return api.services.myServices.responses[200].parse(await res.json());
    },
  });
}

export function useService(id: number) {
  return useQuery({
    queryKey: [api.services.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.services.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch service");
      return api.services.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateServiceInput) => {
      const payload = { ...data, price: String(data.price) };

      const res = await fetch(api.services.create.path, {
        method: api.services.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        const error = await res.json();
        throw new Error(error.message || "Failed to create service");
      }
      return api.services.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.services.list.path] });
    },
  });
}
