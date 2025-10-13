/**
 * Departments hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/departments/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import {
  departmentsDetailDefaultKeys,
  departmentsDetailKeys,
  departmentsListKeys,
} from "@/lib/api/v2/keys";
import {
  CreateDepartmentRequest,
  CreateDepartmentResponseSchema,
  DeleteDepartmentRequest,
  DeleteDepartmentResponseSchema,
  DepartmentDetailResponseSchema,
  DepartmentsFilters,
  DepartmentsListResponseSchema,
  DuplicateDepartmentRequest,
  DuplicateDepartmentResponseSchema,
  UpdateDepartmentRequest,
  UpdateDepartmentResponseSchema,
} from "@/lib/api/v2/schemas/departments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for departments hook options
type DepartmentsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useDepartmentsList(
  filters: DepartmentsFilters,
  options: DepartmentsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: departmentsListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/departments/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return DepartmentsListResponseSchema.parse(res);
    },
  });
}

export function useDepartmentDetail(
  departmentId: string,
  profileId: string,
  options: DepartmentsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: departmentsDetailKeys.detail(departmentId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/departments/detail", {
        method: "POST",
        body: JSON.stringify({ departmentId, profileId }),
      });
      return DepartmentDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!departmentId && !!profileId,
  });
}

export function useDepartmentDetailDefault(
  profileId: string,
  options: DepartmentsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: departmentsDetailDefaultKeys.detail(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/departments/detail-default", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return DepartmentDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateDepartmentRequest) => {
      const res = await api<unknown>("/api/v2/departments/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateDepartmentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" && key.startsWith("departments:v2:list")
          );
        },
      });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateDepartmentRequest) => {
      const res = await api<unknown>("/api/v2/departments/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateDepartmentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" &&
              key.startsWith("departments:v2:list")) ||
            (typeof key === "string" && key.startsWith("departments:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDuplicateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DuplicateDepartmentRequest) => {
      const res = await api<unknown>("/api/v2/departments/duplicate", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DuplicateDepartmentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" && key.startsWith("departments:v2:list")
          );
        },
      });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteDepartmentRequest) => {
      const res = await api<unknown>("/api/v2/departments/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteDepartmentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" && key.startsWith("departments:v2:list")
          );
        },
      });
    },
  });
}
