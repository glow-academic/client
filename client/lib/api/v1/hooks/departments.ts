// AUTO-GENERATED minimal hooks for departments
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import { departmentKeys } from "@/lib/api/v1/keys";
import type {
  Department,
  DepartmentCreate,
  DepartmentUpdate,
} from "@/lib/repos/departmentRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useDepartments(filters?: unknown) {
  return useQuery({
    queryKey: departmentKeys.list(filters),
    queryFn: () => api<Department[]>("/api/v1/departments"),
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DepartmentCreate) =>
      api<Department>("/api/v1/departments", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentKeys.all }),
  });
}

export function useDepartment(id: string, enabled = true) {
  return useQuery({
    queryKey: departmentKeys.detail(id),
    queryFn: () => api<Department>(`/api/v1/departments/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateDepartment(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: DepartmentUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Department>(`/api/v1/departments/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: departmentKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: departmentKeys.all });
      }
    },
  });
}

export function useDeleteDepartment(id?: string) {
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
      return api<void>(`/api/v1/departments/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentKeys.all }),
  });
}
