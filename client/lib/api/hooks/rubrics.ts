// AUTO-GENERATED minimal hooks for rubrics
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import { rubricKeys, rubricKeysByDepartmentId } from "@/lib/api/keys";
import type {
  Rubric,
  RubricCreate,
  RubricUpdate,
} from "@/lib/repos/rubricRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useRubrics(filters?: unknown) {
  return useQuery({
    queryKey: rubricKeys.list(filters),
    queryFn: () => api<Rubric[]>("/api/v1/rubrics"),
  });
}

export function useCreateRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RubricCreate) =>
      api<Rubric>("/api/v1/rubrics", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rubricKeys.all }),
  });
}

export function useRubric(id: string, enabled = true) {
  return useQuery({
    queryKey: rubricKeys.detail(id),
    queryFn: () => api<Rubric>(`/api/v1/rubrics/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateRubric(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: RubricUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Rubric>(`/api/v1/rubrics/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: rubricKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: rubricKeys.all });
      }
    },
  });
}

export function useDeleteRubric(id?: string) {
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
      return api<void>(`/api/v1/rubrics/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rubricKeys.all }),
  });
}

export function useRubricsByDepartmentId(id: string) {
  return useQuery<Rubric[]>({
    queryKey: rubricKeysByDepartmentId.one(id),
    queryFn: () => api<Rubric[]>(`/api/v1/rubrics/by/departmentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useRubricsByDepartmentIdBatch(ids: string[]) {
  return useQuery<Rubric[]>({
    queryKey: rubricKeysByDepartmentId.many(ids),
    queryFn: () =>
      api<Rubric[]>(`/api/v1/rubrics/by/departmentId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
