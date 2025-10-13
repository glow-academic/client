// AUTO-GENERATED minimal hooks for parameter_items
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  parameterItemKeys,
  parameterItemKeysByParameterId,
} from "@/lib/api/v1/keys";
import type {
  ParameterItem,
  ParameterItemCreate,
  ParameterItemUpdate,
} from "@/lib/repos/parameterItemRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useParameterItems(filters?: unknown) {
  return useQuery({
    queryKey: parameterItemKeys.list(filters),
    queryFn: () => api<ParameterItem[]>("/api/v1/parameter_items"),
  });
}

export function useCreateParameterItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ParameterItemCreate) =>
      api<ParameterItem>("/api/v1/parameter_items", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterItemKeys.all }),
  });
}

export function useParameterItem(id: string, enabled = true) {
  return useQuery({
    queryKey: parameterItemKeys.detail(id),
    queryFn: () => api<ParameterItem>(`/api/v1/parameter_items/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateParameterItem(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ParameterItemUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<ParameterItem>(`/api/v1/parameter_items/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({
          queryKey: parameterItemKeys.detail(resolvedId),
        });
      } else {
        qc.invalidateQueries({ queryKey: parameterItemKeys.all });
      }
    },
  });
}

export function useDeleteParameterItem(id?: string) {
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
      return api<void>(`/api/v1/parameter_items/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterItemKeys.all }),
  });
}

export function useParameterItemsByParameterId(id: string) {
  return useQuery<ParameterItem[]>({
    queryKey: parameterItemKeysByParameterId.one(id),
    queryFn: () =>
      api<ParameterItem[]>(`/api/v1/parameter_items/by/parameterId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useParameterItemsByParameterIdBatch(ids: string[]) {
  return useQuery<ParameterItem[]>({
    queryKey: parameterItemKeysByParameterId.many(ids),
    queryFn: () =>
      api<ParameterItem[]>(`/api/v1/parameter_items/by/parameterId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useCreateParameterItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { items: ParameterItemCreate[] }) =>
      api<ParameterItem[]>(`/api/v1/parameter_items/bulk-create`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterItemKeys.all }),
  });
}

export function useUpdateParameterItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      updates: Array<{ id: string } & ParameterItemUpdate>;
    }) =>
      api<ParameterItem[]>(`/api/v1/parameter_items/bulk-update`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterItemKeys.all }),
  });
}

export function useDeleteParameterItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ids: string[] }) =>
      api<ParameterItem[]>(`/api/v1/parameter_items/bulk-delete`, {
        method: "DELETE",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterItemKeys.all }),
  });
}
