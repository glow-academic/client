// AUTO-GENERATED minimal hooks for migrations
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Migration, MigrationCreate, MigrationUpdate } from "@/lib/repos/migrationRepo";
import { migrationKeys  } from "@/lib/api/keys";

export function useMigrations(filters?: unknown) {
  return useQuery({
    queryKey: migrationKeys.list(filters),
    queryFn: () => api<Migration[]>("/api/v1/migrations"),
  });
}

export function useCreateMigration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MigrationCreate) => api<Migration>("/api/v1/migrations", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: migrationKeys.all }),
  });
}

export function useMigration(id: number, enabled = true) {
  return useQuery({
    queryKey: migrationKeys.detail(id),
    queryFn: () => api<Migration>(`/api/v1/migrations/${id}`),
    enabled: enabled && id !== undefined && id !== null,
  });
}

export function useUpdateMigration(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: MigrationUpdate & { id?: number }) => {
      const resolvedId = id ?? (patch as unknown as { id?: number })?.id;
      if (resolvedId === undefined || resolvedId === null) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Migration>(`/api/v1/migrations/${resolvedId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: number } | undefined)?.id;
      if (resolvedId) {
        qc.invalidateQueries({ queryKey: migrationKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: migrationKeys.all });
      }
    },
  });
}

export function useDeleteMigration(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: number } | number) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (resolvedId === undefined || resolvedId === null) {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/migrations/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: migrationKeys.all }),
  });
}

