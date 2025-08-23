// AUTO-GENERATED minimal hooks for providers
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Provider, ProviderCreate, ProviderUpdate } from "@/lib/repos/providerRepo";
import { providerKeys  } from "@/lib/api/keys";

export function useProviders(filters?: unknown) {
  return useQuery({
    queryKey: providerKeys.list(filters),
    queryFn: () => api<Provider[]>("/api/v1/providers"),
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProviderCreate) => api<Provider>("/api/v1/providers", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: providerKeys.all }),
  });
}

export function useProvider(id: string, enabled = true) {
  return useQuery({
    queryKey: providerKeys.detail(id),
    queryFn: () => api<Provider>(`/api/v1/providers/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateProvider(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProviderUpdate) => api<Provider>(`/api/v1/providers/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: providerKeys.detail(id) }),
  });
}

export function useDeleteProvider(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/providers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: providerKeys.all }),
  });
}

