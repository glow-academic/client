// AUTO-GENERATED minimal hooks for simulation_tag_parameter_items
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { SimulationTagParameterItem, SimulationTagParameterItemCreate, SimulationTagParameterItemUpdate } from "@/lib/repos/simulationTagParameterItemRepo";
import { simulationTagParameterItemKeys, simulationTagParameterItemKeysByParameterItemId, simulationTagParameterItemKeysBySimulationId } from "@/lib/api/keys";

export function useSimulationTagParameterItems(filters?: unknown) {
  return useQuery({
    queryKey: simulationTagParameterItemKeys.list(filters),
    queryFn: () => api<SimulationTagParameterItem[]>("/api/v1/simulation_tag_parameter_items"),
  });
}

export function useCreateSimulationTagParameterItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationTagParameterItemCreate) => api<SimulationTagParameterItem>("/api/v1/simulation_tag_parameter_items", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationTagParameterItemKeys.all }),
  });
}


export function useSimulationTagParameterItemsByParameterItemId(id: string) {
  return useQuery<SimulationTagParameterItem[]>({
    queryKey: simulationTagParameterItemKeysByParameterItemId.one(id),
    queryFn: () => api<SimulationTagParameterItem[]>(`/api/v1/simulation_tag_parameter_items/by/parameterItemId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationTagParameterItemsByParameterItemIdBatch(ids: string[]) {
  return useQuery<SimulationTagParameterItem[]>({
    queryKey: simulationTagParameterItemKeysByParameterItemId.many(ids),
    queryFn: () => api<SimulationTagParameterItem[]>(`/api/v1/simulation_tag_parameter_items/by/parameterItemId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationTagParameterItemsBySimulationId(id: string) {
  return useQuery<SimulationTagParameterItem[]>({
    queryKey: simulationTagParameterItemKeysBySimulationId.one(id),
    queryFn: () => api<SimulationTagParameterItem[]>(`/api/v1/simulation_tag_parameter_items/by/simulationId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationTagParameterItemsBySimulationIdBatch(ids: string[]) {
  return useQuery<SimulationTagParameterItem[]>({
    queryKey: simulationTagParameterItemKeysBySimulationId.many(ids),
    queryFn: () => api<SimulationTagParameterItem[]>(`/api/v1/simulation_tag_parameter_items/by/simulationId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
