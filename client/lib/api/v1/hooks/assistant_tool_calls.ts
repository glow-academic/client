// AUTO-GENERATED minimal hooks for assistant_tool_calls
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  assistantToolCallKeys,
  assistantToolCallKeysByChatId,
} from "@/lib/api/v1/keys";
import type {
  AssistantToolCall,
  AssistantToolCallCreate,
  AssistantToolCallUpdate,
} from "@/lib/repos/assistantToolCallRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useAssistantToolCalls(filters?: unknown) {
  return useQuery({
    queryKey: assistantToolCallKeys.list(filters),
    queryFn: () => api<AssistantToolCall[]>("/api/v1/assistant_tool_calls"),
  });
}

export function useCreateAssistantToolCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssistantToolCallCreate) =>
      api<AssistantToolCall>("/api/v1/assistant_tool_calls", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: assistantToolCallKeys.all }),
  });
}

export function useAssistantToolCall(id: string, enabled = true) {
  return useQuery({
    queryKey: assistantToolCallKeys.detail(id),
    queryFn: () => api<AssistantToolCall>(`/api/v1/assistant_tool_calls/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateAssistantToolCall(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AssistantToolCallUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<AssistantToolCall>(
        `/api/v1/assistant_tool_calls/${resolvedId}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({
          queryKey: assistantToolCallKeys.detail(resolvedId),
        });
      } else {
        qc.invalidateQueries({ queryKey: assistantToolCallKeys.all });
      }
    },
  });
}

export function useDeleteAssistantToolCall(id?: string) {
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
      return api<void>(`/api/v1/assistant_tool_calls/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: assistantToolCallKeys.all }),
  });
}

export function useAssistantToolCallsByChatId(id: string) {
  return useQuery<AssistantToolCall[]>({
    queryKey: assistantToolCallKeysByChatId.one(id),
    queryFn: () =>
      api<AssistantToolCall[]>(`/api/v1/assistant_tool_calls/by/chatId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAssistantToolCallsByChatIdBatch(ids: string[]) {
  return useQuery<AssistantToolCall[]>({
    queryKey: assistantToolCallKeysByChatId.many(ids),
    queryFn: () =>
      api<AssistantToolCall[]>(`/api/v1/assistant_tool_calls/by/chatId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
