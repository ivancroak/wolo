"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import type { InsertService } from "@shared/schema";

type CreateServiceInput = z.infer<typeof api.services.create.input>;

export function useServices(filters?: { category?: string; pricingCategory?: string; search?: string; listingType?: string; creatorId?: string }) {
  const queryKey = [api.services.list.path, filters?.category, filters?.pricingCategory, filters?.search, filters?.listingType, filters?.creatorId];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.set("category", filters.category);
      if (filters?.pricingCategory) params.set("pricingCategory", filters.pricingCategory);
      if (filters?.listingType) params.set("listingType", filters.listingType);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.creatorId) params.set("creatorId", filters.creatorId);

      const qs = params.toString();
      const url = qs ? `${api.services.list.path}?${qs}` : api.services.list.path;

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

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertService>) => {
      const res = await apiRequest("PUT", `/api/services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.services.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.services.myServices.path] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/services/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.services.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.services.myServices.path] });
    },
  });
}

