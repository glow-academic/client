// AUTO-GENERATED minimal hooks for assistant_messages
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { AssistantMessage, AssistantMessageCreate, AssistantMessageUpdate } from "@/lib/repos/assistantMessageRepo";
import { assistantMessageKeys, assistantMessageKeysByChatId } from "@/lib/api/keys";

export function useAssistantMessages(filters?: unknown) {
  return useQuery({
    queryKey: assistantMessageKeys.list(filters),
    queryFn: () => api<AssistantMessage[]>("/api/v1/assistant_messages"),
  });
}

export function useCreateAssistantMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssistantMessageCreate) => api<AssistantMessage>("/api/v1/assistant_messages", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: assistantMessageKeys.all }),
  });
}

export function useAssistantMessage(id: string, enabled = true) {
  return useQuery({
    queryKey: assistantMessageKeys.detail(id),
    queryFn: () => api<AssistantMessage>(`/api/v1/assistant_messages/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateAssistantMessage(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AssistantMessageUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<AssistantMessage>(`/api/v1/assistant_messages/${resolvedId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: assistantMessageKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: assistantMessageKeys.all });
      }
    },
  });
}

export function useDeleteAssistantMessage(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/assistant_messages/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: assistantMessageKeys.all }),
  });
}

export function useAssistantMessagesByChatId(id: string) {
  return useQuery<AssistantMessage[]>({
    queryKey: assistantMessageKeysByChatId.one(id),
    queryFn: () => api<AssistantMessage[]>(`/api/v1/assistant_messages/by/chatId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAssistantMessagesByChatIdBatch(ids: string[]) {
  return useQuery<AssistantMessage[]>({
    queryKey: assistantMessageKeysByChatId.many(ids),
    queryFn: () => api<AssistantMessage[]>(`/api/v1/assistant_messages/by/chatId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
