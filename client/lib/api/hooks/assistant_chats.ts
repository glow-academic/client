// AUTO-GENERATED minimal hooks for assistant_chats
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { AssistantChat, AssistantChatCreate, AssistantChatUpdate } from "@/lib/repos/assistantChatRepo";
import { assistantChatKeys, assistantChatKeysByProfileId } from "@/lib/api/keys";

export function useAssistantChats(filters?: unknown) {
  return useQuery({
    queryKey: assistantChatKeys.list(filters),
    queryFn: () => api<AssistantChat[]>("/api/v1/assistant_chats"),
  });
}

export function useCreateAssistantChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssistantChatCreate) => api<AssistantChat>("/api/v1/assistant_chats", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: assistantChatKeys.all }),
  });
}

export function useAssistantChat(id: string, enabled = true) {
  return useQuery({
    queryKey: assistantChatKeys.detail(id),
    queryFn: () => api<AssistantChat>(`/api/v1/assistant_chats/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateAssistantChat(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AssistantChatUpdate) => api<AssistantChat>(`/api/v1/assistant_chats/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: assistantChatKeys.detail(id) }),
  });
}

export function useDeleteAssistantChat(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/assistant_chats/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: assistantChatKeys.all }),
  });
}

export function useAssistantChatsByProfileId(id: string) {
  return useQuery<AssistantChat[]>({
    queryKey: assistantChatKeysByProfileId.one(id),
    queryFn: () => api<AssistantChat[]>(`/api/v1/assistant_chats/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAssistantChatsByProfileIdBatch(ids: string[]) {
  return useQuery<AssistantChat[]>({
    queryKey: assistantChatKeysByProfileId.many(ids),
    queryFn: () => api<AssistantChat[]>(`/api/v1/assistant_chats/by/profileId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
