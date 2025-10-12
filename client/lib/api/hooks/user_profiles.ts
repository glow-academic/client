// AUTO-GENERATED minimal hooks for user_profiles
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { UserProfile, UserProfileCreate, UserProfileUpdate } from "@/lib/repos/userProfileRepo";
import { userProfileKeys, userProfileKeysByUserId, userProfileKeysByProfileId } from "@/lib/api/keys";

export function useUserProfiles(filters?: unknown) {
  return useQuery({
    queryKey: userProfileKeys.list(filters),
    queryFn: () => api<UserProfile[]>("/api/v1/user_profiles"),
  });
}

export function useCreateUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserProfileCreate) => api<UserProfile>("/api/v1/user_profiles", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: userProfileKeys.all }),
  });
}


export function useUserProfilesByUserId(id: string) {
  return useQuery<UserProfile[]>({
    queryKey: userProfileKeysByUserId.one(id),
    queryFn: () => api<UserProfile[]>(`/api/v1/user_profiles/by/userId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useUserProfilesByUserIdBatch(ids: string[]) {
  return useQuery<UserProfile[]>({
    queryKey: userProfileKeysByUserId.many(ids),
    queryFn: () => api<UserProfile[]>(`/api/v1/user_profiles/by/userId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useUserProfilesByProfileId(id: string) {
  return useQuery<UserProfile[]>({
    queryKey: userProfileKeysByProfileId.one(id),
    queryFn: () => api<UserProfile[]>(`/api/v1/user_profiles/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useUserProfilesByProfileIdBatch(ids: string[]) {
  return useQuery<UserProfile[]>({
    queryKey: userProfileKeysByProfileId.many(ids),
    queryFn: () => api<UserProfile[]>(`/api/v1/user_profiles/by/profileId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
