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
    enabled,
  });
}

export function useUpdateAssistantMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AssistantMessageUpdate) => api<AssistantMessage>(`/api/v1/assistant_messages/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: assistantMessageKeys.detail(id) }),
  });
}

export function useDeleteAssistantMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/assistant_messages/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: assistantMessageKeys.all }),
  });
}

export function useAssistantMessagesByChatId(id: string) {
  return useQuery({
    queryKey: assistantMessageKeysByChatId.one(id),
    queryFn: () => api(`/api/v1/assistant_messages/by/chatId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useAssistantMessagesByChatIdBatch(ids: string[]) {
  return useQuery({
    queryKey: assistantMessageKeysByChatId.many(ids),
    queryFn: () => api(`/api/v1/assistant_messages/by/chatId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
