// AUTO-GENERATED minimal hooks for cohorts
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import { cohortKeys } from "@/lib/api/keys";
import type {
  Cohort,
  CohortCreate,
  CohortUpdate,
} from "@/lib/repos/cohortRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCohorts(filters?: unknown) {
  return useQuery({
    queryKey: cohortKeys.list(filters),
    queryFn: () => api<Cohort[]>("/api/v1/cohorts"),
  });
}

export function useCreateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CohortCreate) =>
      api<Cohort>("/api/v1/cohorts", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
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

export function useUpdateCohort(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: CohortUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Cohort>(`/api/v1/cohorts/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: cohortKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: cohortKeys.all });
      }
    },
  });
}

export function useDeleteCohort(id?: string) {
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
      return api<void>(`/api/v1/cohorts/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cohortKeys.all }),
  });
}

export function useUpdateCohorts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { updates: Array<{ id: string } & CohortUpdate> }) =>
      api<Cohort[]>(`/api/v1/cohorts/bulk-update`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cohortKeys.all }),
  });
}
