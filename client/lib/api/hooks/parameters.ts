// AUTO-GENERATED minimal hooks for parameters
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Parameter, ParameterCreate, ParameterUpdate } from "@/lib/repos/parameterRepo";
import { parameterKeys  } from "@/lib/api/keys";

export function useParameters(filters?: unknown) {
  return useQuery({
    queryKey: parameterKeys.list(filters),
    queryFn: () => api<Parameter[]>("/api/v1/parameters"),
  });
}

export function useCreateParameter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ParameterCreate) => api<Parameter>("/api/v1/parameters", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterKeys.all }),
  });
}

export function useParameter(id: string, enabled = true) {
  return useQuery({
    queryKey: parameterKeys.detail(id),
    queryFn: () => api<Parameter>(`/api/v1/parameters/${id}`),
    enabled,
  });
}

export function useUpdateParameter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ParameterUpdate) => api<Parameter>(`/api/v1/parameters/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterKeys.detail(id) }),
  });
}

export function useDeleteParameter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/parameters/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterKeys.all }),
  });
}

