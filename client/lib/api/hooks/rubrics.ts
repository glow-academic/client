// AUTO-GENERATED minimal hooks for rubrics
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Rubric, RubricCreate, RubricUpdate } from "@/lib/repos/rubricRepo";
import { rubricKeys  } from "@/lib/api/keys";

export function useRubrics(filters?: unknown) {
  return useQuery({
    queryKey: rubricKeys.list(filters),
    queryFn: () => api<Rubric[]>("/api/v1/rubrics"),
  });
}

export function useCreateRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RubricCreate) => api<Rubric>("/api/v1/rubrics", { method: "POST", body: JSON.stringify(payload) }),
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

export function useUpdateRubric(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: RubricUpdate) => api<Rubric>(`/api/v1/rubrics/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rubricKeys.detail(id) }),
  });
}

export function useDeleteRubric(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/rubrics/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rubricKeys.all }),
  });
}

