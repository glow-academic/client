// AUTO-GENERATED minimal hooks for cohort_profiles
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  cohortProfileKeys,
  cohortProfileKeysByCohortId,
  cohortProfileKeysByProfileId,
} from "@/lib/api/v1/keys";
import type {
  CohortProfile,
  CohortProfileCreate,
} from "@/lib/repos/cohortProfileRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCohortProfiles(filters?: unknown) {
  return useQuery({
    queryKey: cohortProfileKeys.list(filters),
    queryFn: () => api<CohortProfile[]>("/api/v1/cohort_profiles"),
  });
}

export function useCreateCohortProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CohortProfileCreate) =>
      api<CohortProfile>("/api/v1/cohort_profiles", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cohortProfileKeys.all }),
  });
}

export function useCohortProfilesByCohortId(id: string) {
  return useQuery<CohortProfile[]>({
    queryKey: cohortProfileKeysByCohortId.one(id),
    queryFn: () =>
      api<CohortProfile[]>(`/api/v1/cohort_profiles/by/cohortId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useCohortProfilesByCohortIdBatch(ids: string[]) {
  return useQuery<CohortProfile[]>({
    queryKey: cohortProfileKeysByCohortId.many(ids),
    queryFn: () =>
      api<CohortProfile[]>(`/api/v1/cohort_profiles/by/cohortId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useCohortProfilesByProfileId(id: string) {
  return useQuery<CohortProfile[]>({
    queryKey: cohortProfileKeysByProfileId.one(id),
    queryFn: () =>
      api<CohortProfile[]>(`/api/v1/cohort_profiles/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useCohortProfilesByProfileIdBatch(ids: string[]) {
  return useQuery<CohortProfile[]>({
    queryKey: cohortProfileKeysByProfileId.many(ids),
    queryFn: () =>
      api<CohortProfile[]>(`/api/v1/cohort_profiles/by/profileId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
