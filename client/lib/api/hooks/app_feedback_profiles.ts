// AUTO-GENERATED minimal hooks for app_feedback_profiles
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { AppFeedbackProfile, AppFeedbackProfileCreate, AppFeedbackProfileUpdate } from "@/lib/repos/appFeedbackProfileRepo";
import { appFeedbackProfileKeys, appFeedbackProfileKeysByAppFeedbackId, appFeedbackProfileKeysByProfileId } from "@/lib/api/keys";

export function useAppFeedbackProfiles(filters?: unknown) {
  return useQuery({
    queryKey: appFeedbackProfileKeys.list(filters),
    queryFn: () => api<AppFeedbackProfile[]>("/api/v1/app_feedback_profiles"),
  });
}

export function useCreateAppFeedbackProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AppFeedbackProfileCreate) => api<AppFeedbackProfile>("/api/v1/app_feedback_profiles", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: appFeedbackProfileKeys.all }),
  });
}


export function useAppFeedbackProfilesByAppFeedbackId(id: string) {
  return useQuery<AppFeedbackProfile[]>({
    queryKey: appFeedbackProfileKeysByAppFeedbackId.one(id),
    queryFn: () => api<AppFeedbackProfile[]>(`/api/v1/app_feedback_profiles/by/appFeedbackId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAppFeedbackProfilesByAppFeedbackIdBatch(ids: string[]) {
  return useQuery<AppFeedbackProfile[]>({
    queryKey: appFeedbackProfileKeysByAppFeedbackId.many(ids),
    queryFn: () => api<AppFeedbackProfile[]>(`/api/v1/app_feedback_profiles/by/appFeedbackId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useAppFeedbackProfilesByProfileId(id: string) {
  return useQuery<AppFeedbackProfile[]>({
    queryKey: appFeedbackProfileKeysByProfileId.one(id),
    queryFn: () => api<AppFeedbackProfile[]>(`/api/v1/app_feedback_profiles/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAppFeedbackProfilesByProfileIdBatch(ids: string[]) {
  return useQuery<AppFeedbackProfile[]>({
    queryKey: appFeedbackProfileKeysByProfileId.many(ids),
    queryFn: () => api<AppFeedbackProfile[]>(`/api/v1/app_feedback_profiles/by/profileId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
