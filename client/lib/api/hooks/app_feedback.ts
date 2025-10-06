// AUTO-GENERATED minimal hooks for app_feedback
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type {
  AppFeedback,
  AppFeedbackCreate,
  AppFeedbackUpdate,
} from "@/lib/repos/appFeedbackRepo";
import { appFeedbackKeys, appFeedbackKeysByProfileId } from "@/lib/api/keys";

export function useAppFeedbacks(filters?: unknown) {
  return useQuery({
    queryKey: appFeedbackKeys.list(filters),
    queryFn: () => api<AppFeedback[]>("/api/v1/app_feedback"),
  });
}

export function useCreateAppFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AppFeedbackCreate) =>
      api<AppFeedback>("/api/v1/app_feedback", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: appFeedbackKeys.all }),
  });
}

export function useAppFeedback(id: number, enabled = true) {
  return useQuery({
    queryKey: appFeedbackKeys.detail(id),
    queryFn: () => api<AppFeedback>(`/api/v1/app_feedback/${id}`),
    enabled: enabled && id !== undefined && id !== null,
  });
}

export function useUpdateAppFeedback(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AppFeedbackUpdate & { id?: number }) => {
      const resolvedId = id ?? (patch as unknown as { id?: number })?.id;
      if (resolvedId === undefined || resolvedId === null) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<AppFeedback>(`/api/v1/app_feedback/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: number } | undefined)?.id;
      if (resolvedId) {
        qc.invalidateQueries({ queryKey: appFeedbackKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: appFeedbackKeys.all });
      }
    },
  });
}

export function useDeleteAppFeedback(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: number } | number) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (resolvedId === undefined || resolvedId === null) {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/app_feedback/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: appFeedbackKeys.all }),
  });
}

export function useAppFeedbackByProfileId(id: number) {
  return useQuery<AppFeedback[]>({
    queryKey: appFeedbackKeysByProfileId.one(id),
    queryFn: () =>
      api<AppFeedback[]>(`/api/v1/app_feedback/by/profileId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useAppFeedbackByProfileIdBatch(ids: number[]) {
  return useQuery<AppFeedback[]>({
    queryKey: appFeedbackKeysByProfileId.many(ids),
    queryFn: () =>
      api<AppFeedback[]>(`/api/v1/app_feedback/by/profileId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
