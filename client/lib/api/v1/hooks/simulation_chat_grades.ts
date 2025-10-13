// AUTO-GENERATED minimal hooks for simulation_chat_grades
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  simulationChatGradeKeys,
  simulationChatGradeKeysByRubricId,
  simulationChatGradeKeysBySimulationChatId,
} from "@/lib/api/v1/keys";
import type {
  SimulationChatGrade,
  SimulationChatGradeCreate,
  SimulationChatGradeUpdate,
} from "@/lib/repos/simulationChatGradeRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSimulationChatGrades(filters?: unknown) {
  return useQuery({
    queryKey: simulationChatGradeKeys.list(filters),
    queryFn: () => api<SimulationChatGrade[]>("/api/v1/simulation_chat_grades"),
  });
}

export function useCreateSimulationChatGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationChatGradeCreate) =>
      api<SimulationChatGrade>("/api/v1/simulation_chat_grades", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: simulationChatGradeKeys.all }),
  });
}

export function useSimulationChatGrade(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationChatGradeKeys.detail(id),
    queryFn: () =>
      api<SimulationChatGrade>(`/api/v1/simulation_chat_grades/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulationChatGrade(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationChatGradeUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<SimulationChatGrade>(
        `/api/v1/simulation_chat_grades/${resolvedId}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({
          queryKey: simulationChatGradeKeys.detail(resolvedId),
        });
      } else {
        qc.invalidateQueries({ queryKey: simulationChatGradeKeys.all });
      }
    },
  });
}

export function useDeleteSimulationChatGrade(id?: string) {
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
      return api<void>(`/api/v1/simulation_chat_grades/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: simulationChatGradeKeys.all }),
  });
}

export function useSimulationChatGradesByRubricId(id: string) {
  return useQuery<SimulationChatGrade[]>({
    queryKey: simulationChatGradeKeysByRubricId.one(id),
    queryFn: () =>
      api<SimulationChatGrade[]>(
        `/api/v1/simulation_chat_grades/by/rubricId/${id}`
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationChatGradesByRubricIdBatch(ids: string[]) {
  return useQuery<SimulationChatGrade[]>({
    queryKey: simulationChatGradeKeysByRubricId.many(ids),
    queryFn: () =>
      api<SimulationChatGrade[]>(
        `/api/v1/simulation_chat_grades/by/rubricId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) }
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationChatGradesBySimulationChatId(id: string) {
  return useQuery<SimulationChatGrade[]>({
    queryKey: simulationChatGradeKeysBySimulationChatId.one(id),
    queryFn: () =>
      api<SimulationChatGrade[]>(
        `/api/v1/simulation_chat_grades/by/simulationChatId/${id}`
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationChatGradesBySimulationChatIdBatch(ids: string[]) {
  return useQuery<SimulationChatGrade[]>({
    queryKey: simulationChatGradeKeysBySimulationChatId.many(ids),
    queryFn: () =>
      api<SimulationChatGrade[]>(
        `/api/v1/simulation_chat_grades/by/simulationChatId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) }
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
