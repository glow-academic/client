// AUTO-GENERATED minimal hooks for personas
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Persona, PersonaCreate, PersonaUpdate } from "@/lib/repos/personaRepo";
import { personaKeys, personaKeysByModelId } from "@/lib/api/keys";

export function usePersonas(filters?: unknown) {
  return useQuery({
    queryKey: personaKeys.list(filters),
    queryFn: () => api<Persona[]>("/api/v1/personas"),
  });
}

export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PersonaCreate) => api<Persona>("/api/v1/personas", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.all }),
  });
}

export function usePersona(id: string, enabled = true) {
  return useQuery({
    queryKey: personaKeys.detail(id),
    queryFn: () => api<Persona>(`/api/v1/personas/${id}`),
    enabled,
  });
}

export function useUpdatePersona(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PersonaUpdate) => api<Persona>(`/api/v1/personas/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.detail(id) }),
  });
}

export function useDeletePersona(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/personas/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: personaKeys.all }),
  });
}

export function usePersonasByModelId(id: string) {
  return useQuery({
    queryKey: personaKeysByModelId.one(id),
    queryFn: () => api(`/api/v1/personas/by/modelId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function usePersonasByModelIdBatch(ids: string[]) {
  return useQuery({
    queryKey: personaKeysByModelId.many(ids),
    queryFn: () => api(`/api/v1/personas/by/modelId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
