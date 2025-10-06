// AUTO-GENERATED minimal hooks for models
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Model, ModelCreate, ModelUpdate } from "@/lib/repos/modelRepo";
import { modelKeys } from "@/lib/api/keys";

export function useModels(filters?: unknown) {
  return useQuery({
    queryKey: modelKeys.list(filters),
    queryFn: () => api<Model[]>("/api/v1/models"),
  });
}

export function useCreateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModelCreate) =>
      api<Model>("/api/v1/models", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelKeys.all }),
  });
}

export function useModel(id: string, enabled = true) {
  return useQuery({
    queryKey: modelKeys.detail(id),
    queryFn: () => api<Model>(`/api/v1/models/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateModel(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ModelUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Model>(`/api/v1/models/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: modelKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: modelKeys.all });
      }
    },
  });
}

export function useDeleteModel(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/models/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: modelKeys.all }),
  });
}
