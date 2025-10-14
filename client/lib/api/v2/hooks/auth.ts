/**
 * Auth v2 API hooks for profile and emulation operations.
 */

import { api } from "@/lib/api/fetcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ============================================================================
// TYPES
// ============================================================================

export interface ProfileItem {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: "superadmin" | "admin" | "instructional" | "ta" | "guest";
  active: boolean;
  viewedIntro: boolean;
  viewedChat: boolean;
  defaultProfile: boolean;
  reqPerDay: number | null;
  lastLogin: string;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileDetailResponse {
  profile: ProfileItem;
}

export interface UpdateProfileRequest {
  profileId: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  active?: boolean;
  viewedIntro?: boolean;
  viewedChat?: boolean;
  reqPerDay?: number | null;
}

export interface SimulatableProfilesResponse {
  profiles: ProfileItem[];
}

export interface AuthorizeEmulationResponse {
  allowed: boolean;
  reason?: string | null;
}

// ============================================================================
// PROFILE OPERATIONS
// ============================================================================

/**
 * Hook to fetch profile details by ID.
 */
export function useProfileV2(profileId: string, enabled = true) {
  return useQuery<ProfileDetailResponse>({
    queryKey: ["v2", "auth", "profile", profileId],
    queryFn: () =>
      api<ProfileDetailResponse>("/api/v2/auth/profile/detail", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      }),
    enabled: enabled && !!profileId && profileId !== "",
  });
}

/**
 * Hook to update profile fields.
 */
export function useUpdateProfileV2() {
  const qc = useQueryClient();
  return useMutation<ProfileDetailResponse, Error, UpdateProfileRequest>({
    mutationFn: (data: UpdateProfileRequest) =>
      api<ProfileDetailResponse>("/api/v2/auth/profile/update", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({
        queryKey: ["v2", "auth", "profile", variables.profileId],
      });
    },
  });
}

// ============================================================================
// EMULATION OPERATIONS
// ============================================================================

/**
 * Hook to fetch profiles that can be emulated by the current user.
 */
export function useSimulatableProfiles(
  profileId: string,
  departmentIds: string[],
  enabled = true
) {
  return useQuery<SimulatableProfilesResponse>({
    queryKey: ["v2", "auth", "simulatable", profileId, departmentIds],
    queryFn: () =>
      api<SimulatableProfilesResponse>("/api/v2/auth/simulatable-profiles", {
        method: "POST",
        body: JSON.stringify({ profileId, departmentIds }),
      }),
    enabled: enabled && !!profileId && profileId !== "",
  });
}

/**
 * Function to check if emulation is authorized (not a hook, used for one-time checks).
 */
export async function authorizeEmulation(
  requesterProfileId: string,
  targetProfileId: string,
  departmentIds: string[]
): Promise<AuthorizeEmulationResponse> {
  return api<AuthorizeEmulationResponse>("/api/v2/auth/authorize-emulation", {
    method: "POST",
    body: JSON.stringify({
      requesterProfileId,
      targetProfileId,
      departmentIds,
    }),
  });
}
