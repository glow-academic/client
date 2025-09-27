// AUTO-GENERATED minimal hooks for profiles
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import { profileKeys, profileKeysByUserId } from "@/lib/api/keys";
import type {
  Profile,
  ProfileCreate,
  ProfileUpdate,
} from "@/lib/repos/profileRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useProfiles(filters?: unknown) {
  return useQuery({
    queryKey: profileKeys.list(filters),
    queryFn: () => api<Profile[]>("/api/v1/profiles"),
  });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfileCreate) =>
      api<Profile>("/api/v1/profiles", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

export function useCreateProfiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payloads: ProfileCreate[]) =>
      api<Profile[]>("/api/v1/profiles/bulk", {
        method: "POST",
        body: JSON.stringify({ profiles: payloads }),
      }),
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

export function useUpdateProfile(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfileUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Profile>(`/api/v1/profiles/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: profileKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: profileKeys.all });
      }
    },
  });
}

export function useDeleteProfile(id?: string) {
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
      return api<void>(`/api/v1/profiles/${resolvedId}`, { method: "DELETE" });
    },
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
    queryFn: () =>
      api<Profile[]>(`/api/v1/profiles/by/userId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
