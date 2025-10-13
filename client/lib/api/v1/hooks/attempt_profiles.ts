// AUTO-GENERATED minimal hooks for attempt_profiles
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  attemptProfileKeys,
  attemptProfileKeysByAttemptId,
  attemptProfileKeysByProfileId,
} from "@/lib/api/v1/keys";
import type {
  AttemptProfile,
  AttemptProfileCreate,
} from "@/lib/repos/attemptProfileRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useAttemptProfiles(filters?: unknown) {
  return useQuery({
    queryKey: attemptProfileKeys.list(filters),
    queryFn: () => api<AttemptProfile[]>("/api/v1/attempt_profiles"),
  });
}

export function useCreateAttemptProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttemptProfileCreate) =>
      api<AttemptProfile>("/api/v1/attempt_profiles", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: attemptProfileKeys.all }),
  });
}

export function useAttemptProfilesByAttemptId(id: string) {
  return useQuery<AttemptProfile[]>({
    queryKey: attemptProfileKeysByAttemptId.one(id),
    queryFn: () =>
      api<AttemptProfile[]>(`/api/v1/attempt_profiles/by/attemptId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAttemptProfilesByAttemptIdBatch(ids: string[]) {
  return useQuery<AttemptProfile[]>({
    queryKey: attemptProfileKeysByAttemptId.many(ids),
    queryFn: () =>
      api<AttemptProfile[]>(`/api/v1/attempt_profiles/by/attemptId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useAttemptProfilesByProfileId(id: string) {
  return useQuery<AttemptProfile[]>({
    queryKey: attemptProfileKeysByProfileId.one(id),
    queryFn: () =>
      api<AttemptProfile[]>(`/api/v1/attempt_profiles/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAttemptProfilesByProfileIdBatch(ids: string[]) {
  return useQuery<AttemptProfile[]>({
    queryKey: attemptProfileKeysByProfileId.many(ids),
    queryFn: () =>
      api<AttemptProfile[]>(`/api/v1/attempt_profiles/by/profileId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
