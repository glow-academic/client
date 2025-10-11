// AUTO-GENERATED minimal hooks for department_agents
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { DepartmentAgent, DepartmentAgentCreate, DepartmentAgentUpdate } from "@/lib/repos/departmentAgentRepo";
import { departmentAgentKeys, departmentAgentKeysByDepartmentId, departmentAgentKeysByAgentId } from "@/lib/api/keys";

export function useDepartmentAgents(filters?: unknown) {
  return useQuery({
    queryKey: departmentAgentKeys.list(filters),
    queryFn: () => api<DepartmentAgent[]>("/api/v1/department_agents"),
  });
}

export function useCreateDepartmentAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DepartmentAgentCreate) => api<DepartmentAgent>("/api/v1/department_agents", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentAgentKeys.all }),
  });
}


export function useDepartmentAgentsByDepartmentId(id: string) {
  return useQuery<DepartmentAgent[]>({
    queryKey: departmentAgentKeysByDepartmentId.one(id),
    queryFn: () => api<DepartmentAgent[]>(`/api/v1/department_agents/by/departmentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useDepartmentAgentsByDepartmentIdBatch(ids: string[]) {
  return useQuery<DepartmentAgent[]>({
    queryKey: departmentAgentKeysByDepartmentId.many(ids),
    queryFn: () => api<DepartmentAgent[]>(`/api/v1/department_agents/by/departmentId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useDepartmentAgentsByAgentId(id: string) {
  return useQuery<DepartmentAgent[]>({
    queryKey: departmentAgentKeysByAgentId.one(id),
    queryFn: () => api<DepartmentAgent[]>(`/api/v1/department_agents/by/agentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useDepartmentAgentsByAgentIdBatch(ids: string[]) {
  return useQuery<DepartmentAgent[]>({
    queryKey: departmentAgentKeysByAgentId.many(ids),
    queryFn: () => api<DepartmentAgent[]>(`/api/v1/department_agents/by/agentId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
