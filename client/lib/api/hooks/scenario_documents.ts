// AUTO-GENERATED minimal hooks for scenario_documents
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { ScenarioDocument, ScenarioDocumentCreate, ScenarioDocumentUpdate } from "@/lib/repos/scenarioDocumentRepo";
import { scenarioDocumentKeys, scenarioDocumentKeysByScenarioId, scenarioDocumentKeysByDocumentId } from "@/lib/api/keys";

export function useScenarioDocuments(filters?: unknown) {
  return useQuery({
    queryKey: scenarioDocumentKeys.list(filters),
    queryFn: () => api<ScenarioDocument[]>("/api/v1/scenario_documents"),
  });
}

export function useCreateScenarioDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScenarioDocumentCreate) => api<ScenarioDocument>("/api/v1/scenario_documents", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scenarioDocumentKeys.all }),
  });
}


export function useScenarioDocumentsByScenarioId(id: string) {
  return useQuery<ScenarioDocument[]>({
    queryKey: scenarioDocumentKeysByScenarioId.one(id),
    queryFn: () => api<ScenarioDocument[]>(`/api/v1/scenario_documents/by/scenarioId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenarioDocumentsByScenarioIdBatch(ids: string[]) {
  return useQuery<ScenarioDocument[]>({
    queryKey: scenarioDocumentKeysByScenarioId.many(ids),
    queryFn: () => api<ScenarioDocument[]>(`/api/v1/scenario_documents/by/scenarioId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useScenarioDocumentsByDocumentId(id: string) {
  return useQuery<ScenarioDocument[]>({
    queryKey: scenarioDocumentKeysByDocumentId.one(id),
    queryFn: () => api<ScenarioDocument[]>(`/api/v1/scenario_documents/by/documentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenarioDocumentsByDocumentIdBatch(ids: string[]) {
  return useQuery<ScenarioDocument[]>({
    queryKey: scenarioDocumentKeysByDocumentId.many(ids),
    queryFn: () => api<ScenarioDocument[]>(`/api/v1/scenario_documents/by/documentId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
