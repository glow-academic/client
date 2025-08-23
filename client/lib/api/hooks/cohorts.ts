// AUTO-GENERATED minimal hooks for cohorts
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Cohort, CohortCreate, CohortUpdate } from "@/lib/repos/cohortRepo";
import { cohortKeys  } from "@/lib/api/keys";

export function useCohorts(filters?: unknown) {
  return useQuery({
    queryKey: cohortKeys.list(filters),
    queryFn: () => api<Cohort[]>("/api/v1/cohorts"),
  });
}

export function useCreateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CohortCreate) => api<Cohort>("/api/v1/cohorts", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cohortKeys.all }),
  });
}

export function useCohort(id: string, enabled = true) {
  return useQuery({
    queryKey: cohortKeys.detail(id),
    queryFn: () => api<Cohort>(`/api/v1/cohorts/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateCohort(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: CohortUpdate) => api<Cohort>(`/api/v1/cohorts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cohortKeys.detail(id) }),
  });
}

export function useDeleteCohort(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/cohorts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cohortKeys.all }),
  });
}

