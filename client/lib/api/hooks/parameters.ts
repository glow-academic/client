// AUTO-GENERATED minimal hooks for parameters
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type {
  Parameter,
  ParameterCreate,
  ParameterUpdate,
} from "@/lib/repos/parameterRepo";
import { parameterKeys, parameterKeysByDepartmentId } from "@/lib/api/keys";

export function useParameters(filters?: unknown) {
  return useQuery({
    queryKey: parameterKeys.list(filters),
    queryFn: () => api<Parameter[]>("/api/v1/parameters"),
  });
}

export function useCreateParameter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ParameterCreate) =>
      api<Parameter>("/api/v1/parameters", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterKeys.all }),
  });
}

export function useParameter(id: string, enabled = true) {
  return useQuery({
    queryKey: parameterKeys.detail(id),
    queryFn: () => api<Parameter>(`/api/v1/parameters/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateParameter(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ParameterUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Parameter>(`/api/v1/parameters/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: parameterKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: parameterKeys.all });
      }
    },
  });
}

export function useDeleteParameter(id?: string) {
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
      return api<void>(`/api/v1/parameters/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterKeys.all }),
  });
}

export function useParametersByDepartmentId(id: string) {
  return useQuery<Parameter[]>({
    queryKey: parameterKeysByDepartmentId.one(id),
    queryFn: () => api<Parameter[]>(`/api/v1/parameters/by/departmentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useParametersByDepartmentIdBatch(ids: string[]) {
  return useQuery<Parameter[]>({
    queryKey: parameterKeysByDepartmentId.many(ids),
    queryFn: () =>
      api<Parameter[]>(`/api/v1/parameters/by/departmentId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
