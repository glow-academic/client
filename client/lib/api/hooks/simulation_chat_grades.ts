// AUTO-GENERATED minimal hooks for simulation_chat_grades
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { SimulationChatGrade, SimulationChatGradeCreate, SimulationChatGradeUpdate } from "@/lib/repos/simulationChatGradeRepo";
import { simulationChatGradeKeys, simulationChatGradeKeysByRubricId, simulationChatGradeKeysBySimulationChatId } from "@/lib/api/keys";

export function useSimulationChatGrades(filters?: unknown) {
  return useQuery({
    queryKey: simulationChatGradeKeys.list(filters),
    queryFn: () => api<SimulationChatGrade[]>("/api/v1/simulation_chat_grades"),
  });
}

export function useCreateSimulationChatGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationChatGradeCreate) => api<SimulationChatGrade>("/api/v1/simulation_chat_grades", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatGradeKeys.all }),
  });
}

export function useSimulationChatGrade(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationChatGradeKeys.detail(id),
    queryFn: () => api<SimulationChatGrade>(`/api/v1/simulation_chat_grades/${id}`),
    enabled,
  });
}

export function useUpdateSimulationChatGrade(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationChatGradeUpdate) => api<SimulationChatGrade>(`/api/v1/simulation_chat_grades/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatGradeKeys.detail(id) }),
  });
}

export function useDeleteSimulationChatGrade(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/simulation_chat_grades/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatGradeKeys.all }),
  });
}

export function useSimulationChatGradesByRubricId(id: string) {
  return useQuery({
    queryKey: simulationChatGradeKeysByRubricId.one(id),
    queryFn: () => api(`/api/v1/simulation_chat_grades/by/rubricId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useSimulationChatGradesByRubricIdBatch(ids: string[]) {
  return useQuery({
    queryKey: simulationChatGradeKeysByRubricId.many(ids),
    queryFn: () => api(`/api/v1/simulation_chat_grades/by/rubricId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationChatGradesBySimulationChatId(id: string) {
  return useQuery({
    queryKey: simulationChatGradeKeysBySimulationChatId.one(id),
    queryFn: () => api(`/api/v1/simulation_chat_grades/by/simulationChatId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useSimulationChatGradesBySimulationChatIdBatch(ids: string[]) {
  return useQuery({
    queryKey: simulationChatGradeKeysBySimulationChatId.many(ids),
    queryFn: () => api(`/api/v1/simulation_chat_grades/by/simulationChatId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
