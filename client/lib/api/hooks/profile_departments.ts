// AUTO-GENERATED minimal hooks for profile_departments
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { ProfileDepartment, ProfileDepartmentCreate, ProfileDepartmentUpdate } from "@/lib/repos/profileDepartmentRepo";
import { profileDepartmentKeys, profileDepartmentKeysByProfileId, profileDepartmentKeysByDepartmentId } from "@/lib/api/keys";

export function useProfileDepartments(filters?: unknown) {
  return useQuery({
    queryKey: profileDepartmentKeys.list(filters),
    queryFn: () => api<ProfileDepartment[]>("/api/v1/profile_departments"),
  });
}

export function useCreateProfileDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfileDepartmentCreate) => api<ProfileDepartment>("/api/v1/profile_departments", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileDepartmentKeys.all }),
  });
}


export function useProfileDepartmentsByProfileId(id: string) {
  return useQuery<ProfileDepartment[]>({
    queryKey: profileDepartmentKeysByProfileId.one(id),
    queryFn: () => api<ProfileDepartment[]>(`/api/v1/profile_departments/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useProfileDepartmentsByProfileIdBatch(ids: string[]) {
  return useQuery<ProfileDepartment[]>({
    queryKey: profileDepartmentKeysByProfileId.many(ids),
    queryFn: () => api<ProfileDepartment[]>(`/api/v1/profile_departments/by/profileId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useProfileDepartmentsByDepartmentId(id: string) {
  return useQuery<ProfileDepartment[]>({
    queryKey: profileDepartmentKeysByDepartmentId.one(id),
    queryFn: () => api<ProfileDepartment[]>(`/api/v1/profile_departments/by/departmentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useProfileDepartmentsByDepartmentIdBatch(ids: string[]) {
  return useQuery<ProfileDepartment[]>({
    queryKey: profileDepartmentKeysByDepartmentId.many(ids),
    queryFn: () => api<ProfileDepartment[]>(`/api/v1/profile_departments/by/departmentId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
