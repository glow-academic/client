// AUTO-GENERATED minimal hooks for assistant_chats
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  assistantChatKeys,
  assistantChatKeysByProfileId,
} from "@/lib/api/v1/keys";
import type {
  AssistantChat,
  AssistantChatCreate,
  AssistantChatUpdate,
} from "@/lib/repos/assistantChatRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useAssistantChats(filters?: unknown) {
  return useQuery({
    queryKey: assistantChatKeys.list(filters),
    queryFn: () => api<AssistantChat[]>("/api/v1/assistant_chats"),
  });
}

export function useCreateAssistantChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssistantChatCreate) =>
      api<AssistantChat>("/api/v1/assistant_chats", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
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

export function useUpdateAssistantChat(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AssistantChatUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<AssistantChat>(`/api/v1/assistant_chats/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({
          queryKey: assistantChatKeys.detail(resolvedId),
        });
      } else {
        qc.invalidateQueries({ queryKey: assistantChatKeys.all });
      }
    },
  });
}

export function useDeleteAssistantChat(id?: string) {
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
      return api<void>(`/api/v1/assistant_chats/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: assistantChatKeys.all }),
  });
}

export function useAssistantChatsByProfileId(id: string) {
  return useQuery<AssistantChat[]>({
    queryKey: assistantChatKeysByProfileId.one(id),
    queryFn: () =>
      api<AssistantChat[]>(`/api/v1/assistant_chats/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAssistantChatsByProfileIdBatch(ids: string[]) {
  return useQuery<AssistantChat[]>({
    queryKey: assistantChatKeysByProfileId.many(ids),
    queryFn: () =>
      api<AssistantChat[]>(`/api/v1/assistant_chats/by/profileId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
