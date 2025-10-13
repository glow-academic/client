// AUTO-GENERATED minimal hooks for simulation_tag_documents
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  simulationTagDocumentKeys,
  simulationTagDocumentKeysByDocumentId,
  simulationTagDocumentKeysBySimulationId,
} from "@/lib/api/v1/keys";
import type {
  SimulationTagDocument,
  SimulationTagDocumentCreate,
} from "@/lib/repos/simulationTagDocumentRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSimulationTagDocuments(filters?: unknown) {
  return useQuery({
    queryKey: simulationTagDocumentKeys.list(filters),
    queryFn: () =>
      api<SimulationTagDocument[]>("/api/v1/simulation_tag_documents"),
  });
}

export function useCreateSimulationTagDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationTagDocumentCreate) =>
      api<SimulationTagDocument>("/api/v1/simulation_tag_documents", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: simulationTagDocumentKeys.all }),
  });
}

export function useSimulationTagDocumentsByDocumentId(id: string) {
  return useQuery<SimulationTagDocument[]>({
    queryKey: simulationTagDocumentKeysByDocumentId.one(id),
    queryFn: () =>
      api<SimulationTagDocument[]>(
        `/api/v1/simulation_tag_documents/by/documentId/${id}`
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationTagDocumentsByDocumentIdBatch(ids: string[]) {
  return useQuery<SimulationTagDocument[]>({
    queryKey: simulationTagDocumentKeysByDocumentId.many(ids),
    queryFn: () =>
      api<SimulationTagDocument[]>(
        `/api/v1/simulation_tag_documents/by/documentId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) }
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationTagDocumentsBySimulationId(id: string) {
  return useQuery<SimulationTagDocument[]>({
    queryKey: simulationTagDocumentKeysBySimulationId.one(id),
    queryFn: () =>
      api<SimulationTagDocument[]>(
        `/api/v1/simulation_tag_documents/by/simulationId/${id}`
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationTagDocumentsBySimulationIdBatch(ids: string[]) {
  return useQuery<SimulationTagDocument[]>({
    queryKey: simulationTagDocumentKeysBySimulationId.many(ids),
    queryFn: () =>
      api<SimulationTagDocument[]>(
        `/api/v1/simulation_tag_documents/by/simulationId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) }
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
