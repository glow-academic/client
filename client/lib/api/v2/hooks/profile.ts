/**
 * Profile hooks for v2 API - unified auth and staff operations
 * These hooks call client-side BFF routes at /api/v2/profile/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import {
  profileDetailBulkKeys,
  profileDetailKeys,
  profileListKeys,
  profileSimpleKeys,
} from "@/lib/api/v2/keys";
import {
  AuthorizeEmulationRequest,
  AuthorizeEmulationResponseSchema,
  BulkCreateOrUpdateStaffRequest,
  BulkCreateOrUpdateStaffResponseSchema,
  BulkCreateProfileRequest,
  BulkCreateProfileResponseSchema,
  BulkDeleteProfileRequest,
  BulkDeleteProfileResponseSchema,
  BulkUpdateProfileRequest,
  BulkUpdateProfileResponseSchema,
  CreateOrUpdateStaffRequest,
  CreateOrUpdateStaffResponseSchema,
  CreateProfileRequest,
  CreateProfileResponseSchema,
  CreateStaffDataRequest,
  CreateStaffDataResponseSchema,
  ProcessCSVRequest,
  ProcessCSVResponseSchema,
  DeleteProfileRequest,
  DeleteProfileResponseSchema,
  MarkChatCompleteRequest,
  MarkIntroCompleteRequest,
  MarkTourStepResponseSchema,
  ProfileDetailBulkResponseSchema,
  ProfileDetailResponseSchema,
  ProfileFilters,
  ProfileItem,
  ProfileListResponseSchema,
  ProfileSimpleDetailResponse,
  UpdateProfileRequest,
  UpdateProfileResponseSchema,
  UpdateProfileSimpleRequest,
  UpdateProfileSimpleResponse,
} from "@/lib/api/v2/schemas/profile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for profile hook options
type ProfileHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

// ============================================================================
// PROFILE LIST & DETAIL HOOKS
// ============================================================================

export function useProfileList(
  filters: ProfileFilters,
  options: ProfileHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: profileListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/profile/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return ProfileListResponseSchema.parse(res);
    },
  });
}

export function useProfileDetail(
  profileId: string,
  currentProfileId: string,
  options: ProfileHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: profileDetailKeys.detail(profileId, currentProfileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/profile/detail", {
        method: "POST",
        body: JSON.stringify({ profileId, currentProfileId }),
      });
      return ProfileDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId && !!currentProfileId,
  });
}

export function useProfileDetailBulk(
  profileIds: string[],
  currentProfileId: string,
  options: ProfileHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: profileDetailBulkKeys.detail(profileIds, currentProfileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/profile/detail-bulk", {
        method: "POST",
        body: JSON.stringify({ profileIds, currentProfileId }),
      });
      return ProfileDetailBulkResponseSchema.parse(res);
    },
    enabled:
      queryOptions.enabled && profileIds.length > 0 && !!currentProfileId,
  });
}

// ============================================================================
// PROFILE CREATE HOOKS
// ============================================================================

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateProfileRequest) => {
      const res = await api<unknown>("/api/v2/profile/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateProfileResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("profile:v2:list");
        },
      });
    },
  });
}

export function useBulkCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkCreateProfileRequest) => {
      const res = await api<unknown>("/api/v2/profile/bulk-create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return BulkCreateProfileResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("profile:v2:list");
        },
      });
    },
  });
}

// ============================================================================
// CREATE STAFF DATA HOOKS
// ============================================================================

export function useCreateStaffData(
  request: CreateStaffDataRequest,
  options: ProfileHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: ["profile:v2:create-staff-data", request],
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/profile/create-staff-data", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateStaffDataResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!request.profileId,
  });
}

// ============================================================================
// CSV PROCESSING HOOKS
// ============================================================================

export function useProcessCSV() {
  return useMutation({
    mutationFn: async (request: ProcessCSVRequest) => {
      const res = await api<unknown>("/api/v2/profile/process-csv", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return ProcessCSVResponseSchema.parse(res);
    },
  });
}

// ============================================================================
// CREATE OR UPDATE STAFF HOOKS
// ============================================================================

export function useCreateOrUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateOrUpdateStaffRequest) => {
      const res = await api<unknown>("/api/v2/profile/create-or-update-staff", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateOrUpdateStaffResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("profile:v2:list");
        },
      });
    },
  });
}

export function useBulkCreateOrUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkCreateOrUpdateStaffRequest) => {
      const res = await api<unknown>(
        "/api/v2/profile/bulk-create-or-update-staff",
        {
          method: "POST",
          body: JSON.stringify(request),
        }
      );
      return BulkCreateOrUpdateStaffResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("profile:v2:list");
        },
      });
    },
  });
}

// ============================================================================
// PROFILE UPDATE HOOKS
// ============================================================================

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateProfileRequest) => {
      const res = await api<unknown>("/api/v2/profile/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateProfileResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("profile:v2:list")) ||
            (typeof key === "string" && key.startsWith("profile:v2:detail"))
          );
        },
      });
    },
  });
}

export function useBulkUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkUpdateProfileRequest) => {
      const res = await api<unknown>("/api/v2/profile/bulk-update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return BulkUpdateProfileResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("profile:v2:list")) ||
            (typeof key === "string" && key.startsWith("profile:v2:detail"))
          );
        },
      });
    },
  });
}

// ============================================================================
// PROFILE DELETE HOOKS
// ============================================================================

export function useDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteProfileRequest) => {
      const res = await api<unknown>("/api/v2/profile/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteProfileResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("profile:v2:list");
        },
      });
    },
  });
}

export function useBulkDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkDeleteProfileRequest) => {
      const res = await api<unknown>("/api/v2/profile/bulk-delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return BulkDeleteProfileResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("profile:v2:list");
        },
      });
    },
  });
}

// ============================================================================
// SIMPLE PROFILE HOOKS (for auth operations)
// ============================================================================

/**
 * Hook to fetch simple profile details by ID (auth version).
 */
export function useProfileSimple(profileId: string, enabled = true) {
  return useQuery<ProfileSimpleDetailResponse>({
    queryKey: profileSimpleKeys.detail(profileId),
    queryFn: () =>
      api<ProfileSimpleDetailResponse>("/api/v2/profile/detail-simple", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      }),
    enabled: enabled && !!profileId && profileId !== "",
  });
}

/**
 * Hook to update simple profile fields (auth version).
 */
export function useUpdateProfileSimple() {
  const qc = useQueryClient();
  return useMutation<
    UpdateProfileSimpleResponse,
    Error,
    UpdateProfileSimpleRequest
  >({
    mutationFn: (data: UpdateProfileSimpleRequest) =>
      api<UpdateProfileSimpleResponse>("/api/v2/profile/update-simple", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({
        queryKey: profileSimpleKeys.detail(variables.profileId),
      });
    },
  });
}

// ============================================================================
// EMULATION HOOKS
// ============================================================================

/**
 * Hook to authorize emulation (TanStack Query mutation).
 */
export function useAuthorizeEmulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AuthorizeEmulationRequest) => {
      const res = await api<unknown>("/api/v2/profile/authorize-emulation", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return AuthorizeEmulationResponseSchema.parse(res);
    },
    onSuccess: () => {
      // Invalidate profile context queries since emulation affects context
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("profile:v2")) ||
            (typeof key === "string" && key === "v2")
          );
        },
      });
    },
  });
}

// ============================================================================
// TOUR COMPLETION HOOKS
// ============================================================================

/**
 * Hook to mark intro tour step as complete.
 */
export function useMarkIntroComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: MarkIntroCompleteRequest) => {
      const res = await api<unknown>("/api/v2/profile/mark-intro-complete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return MarkTourStepResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("profile:v2")) ||
            (typeof key === "string" && key === "v2")
          );
        },
      });
    },
  });
}

/**
 * Hook to mark chat tour step as complete.
 */
export function useMarkChatComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: MarkChatCompleteRequest) => {
      const res = await api<unknown>("/api/v2/profile/mark-chat-complete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return MarkTourStepResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("profile:v2")) ||
            (typeof key === "string" && key === "v2")
          );
        },
      });
    },
  });
}

// ============================================================================
// TYPE EXPORTS FOR CONVENIENCE
// ============================================================================

export type { ProfileItem };
