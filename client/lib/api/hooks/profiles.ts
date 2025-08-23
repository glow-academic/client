// AUTO-GENERATED minimal hooks for profiles
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Profile, ProfileCreate, ProfileUpdate } from "@/lib/repos/profileRepo";
import { profileKeys, profileKeysByUserId } from "@/lib/api/keys";

export function useProfiles(filters?: unknown) {
  return useQuery({
    queryKey: profileKeys.list(filters),
    queryFn: () => api<Profile[]>("/api/v1/profiles"),
  });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfileCreate) => api<Profile>("/api/v1/profiles", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

export function useProfile(id: string, enabled = true) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    queryFn: () => api<Profile>(`/api/v1/profiles/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfileUpdate) => api<Profile>(`/api/v1/profiles/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.detail(id) }),
  });
}

export function useDeleteProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/profiles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

export function useProfilesByUserId(id: string) {
  return useQuery<Profile[]>({
    queryKey: profileKeysByUserId.one(id),
    queryFn: () => api<Profile[]>(`/api/v1/profiles/by/userId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useProfilesByUserIdBatch(ids: string[]) {
  return useQuery<Profile[]>({
    queryKey: profileKeysByUserId.many(ids),
    queryFn: () => api<Profile[]>(`/api/v1/profiles/by/userId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
