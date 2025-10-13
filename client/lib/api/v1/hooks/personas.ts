// AUTO-GENERATED minimal hooks for personas
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  personaKeys,
  personaKeysByDepartmentId,
  personaKeysByModelId,
} from "@/lib/api/v1/keys";
import type {
  Persona,
  PersonaCreate,
  PersonaUpdate,
} from "@/lib/repos/personaRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function usePersonas(filters?: unknown) {
  return useQuery({
    queryKey: personaKeys.list(filters),
    queryFn: () => api<Persona[]>("/api/v1/personas"),
  });
}

export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PersonaCreate) =>
      api<Persona>("/api/v1/personas", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.all }),
  });
}

export function usePersona(id: string, enabled = true) {
  return useQuery({
    queryKey: personaKeys.detail(id),
    queryFn: () => api<Persona>(`/api/v1/personas/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdatePersona(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PersonaUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Persona>(`/api/v1/personas/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: personaKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: personaKeys.all });
      }
    },
  });
}

export function useDeletePersona(id?: string) {
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
      return api<void>(`/api/v1/personas/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.all }),
  });
}

export function usePersonasByModelId(id: string) {
  return useQuery<Persona[]>({
    queryKey: personaKeysByModelId.one(id),
    queryFn: () => api<Persona[]>(`/api/v1/personas/by/modelId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function usePersonasByModelIdBatch(ids: string[]) {
  return useQuery<Persona[]>({
    queryKey: personaKeysByModelId.many(ids),
    queryFn: () =>
      api<Persona[]>(`/api/v1/personas/by/modelId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function usePersonasByDepartmentId(id: string) {
  return useQuery<Persona[]>({
    queryKey: personaKeysByDepartmentId.one(id),
    queryFn: () => api<Persona[]>(`/api/v1/personas/by/departmentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function usePersonasByDepartmentIdBatch(ids: string[]) {
  return useQuery<Persona[]>({
    queryKey: personaKeysByDepartmentId.many(ids),
    queryFn: () =>
      api<Persona[]>(`/api/v1/personas/by/departmentId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
