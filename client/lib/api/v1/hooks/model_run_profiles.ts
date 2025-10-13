// AUTO-GENERATED minimal hooks for model_run_profiles
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  modelRunProfileKeys,
  modelRunProfileKeysByModelRunId,
  modelRunProfileKeysByProfileId,
} from "@/lib/api/v1/keys";
import type {
  ModelRunProfile,
  ModelRunProfileCreate,
} from "@/lib/repos/modelRunProfileRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useModelRunProfiles(filters?: unknown) {
  return useQuery({
    queryKey: modelRunProfileKeys.list(filters),
    queryFn: () => api<ModelRunProfile[]>("/api/v1/model_run_profiles"),
  });
}

export function useCreateModelRunProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModelRunProfileCreate) =>
      api<ModelRunProfile>("/api/v1/model_run_profiles", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: modelRunProfileKeys.all }),
  });
}

export function useModelRunProfilesByModelRunId(id: string) {
  return useQuery<ModelRunProfile[]>({
    queryKey: modelRunProfileKeysByModelRunId.one(id),
    queryFn: () =>
      api<ModelRunProfile[]>(`/api/v1/model_run_profiles/by/modelRunId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunProfilesByModelRunIdBatch(ids: string[]) {
  return useQuery<ModelRunProfile[]>({
    queryKey: modelRunProfileKeysByModelRunId.many(ids),
    queryFn: () =>
      api<ModelRunProfile[]>(`/api/v1/model_run_profiles/by/modelRunId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunProfilesByProfileId(id: string) {
  return useQuery<ModelRunProfile[]>({
    queryKey: modelRunProfileKeysByProfileId.one(id),
    queryFn: () =>
      api<ModelRunProfile[]>(`/api/v1/model_run_profiles/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunProfilesByProfileIdBatch(ids: string[]) {
  return useQuery<ModelRunProfile[]>({
    queryKey: modelRunProfileKeysByProfileId.many(ids),
    queryFn: () =>
      api<ModelRunProfile[]>(`/api/v1/model_run_profiles/by/profileId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
