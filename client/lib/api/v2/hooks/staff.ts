/**
 * Staff hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/staff/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import {
  staffDetailBulkKeys,
  staffDetailKeys,
  staffListKeys,
} from "@/lib/api/v2/keys";
import {
  BulkDeleteStaffRequest,
  BulkDeleteStaffResponseSchema,
  BulkUpdateStaffRequest,
  BulkUpdateStaffResponseSchema,
  DeleteStaffRequest,
  DeleteStaffResponseSchema,
  StaffDetailBulkResponseSchema,
  StaffDetailResponseSchema,
  StaffFilters,
  StaffListResponseSchema,
  UpdateStaffRequest,
  UpdateStaffResponseSchema,
} from "@/lib/api/v2/schemas/staff";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for staff hook options
type StaffHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useStaffList(
  filters: StaffFilters,
  options: StaffHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: staffListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/staff/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return StaffListResponseSchema.parse(res);
    },
  });
}

export function useStaffDetail(
  profileId: string,
  currentProfileId: string,
  options: StaffHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: staffDetailKeys.detail(profileId, currentProfileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/staff/detail", {
        method: "POST",
        body: JSON.stringify({ profileId, currentProfileId }),
      });
      return StaffDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId && !!currentProfileId,
  });
}

export function useStaffDetailBulk(
  profileIds: string[],
  currentProfileId: string,
  options: StaffHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: staffDetailBulkKeys.detail(profileIds, currentProfileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/staff/detail-bulk", {
        method: "POST",
        body: JSON.stringify({ profileIds, currentProfileId }),
      });
      return StaffDetailBulkResponseSchema.parse(res);
    },
    enabled:
      queryOptions.enabled && profileIds.length > 0 && !!currentProfileId,
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateStaffRequest) => {
      const res = await api<unknown>("/api/v2/staff/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateStaffResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("staff:v2:list")) ||
            (typeof key === "string" && key.startsWith("staff:v2:detail"))
          );
        },
      });
    },
  });
}

export function useBulkUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkUpdateStaffRequest) => {
      const res = await api<unknown>("/api/v2/staff/bulk-update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return BulkUpdateStaffResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("staff:v2:list")) ||
            (typeof key === "string" && key.startsWith("staff:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteStaffRequest) => {
      const res = await api<unknown>("/api/v2/staff/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteStaffResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("staff:v2:list");
        },
      });
    },
  });
}

export function useBulkDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkDeleteStaffRequest) => {
      const res = await api<unknown>("/api/v2/staff/bulk-delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return BulkDeleteStaffResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("staff:v2:list");
        },
      });
    },
  });
}
