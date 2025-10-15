/**
 * V2 API hooks for assistant
 * Centralized data fetching for assistant chats
 */

import { api } from "@/lib/api/fetcher";
import { assistantChatsFullKeys } from "@/lib/api/v2/keys";
import { useQuery } from "@tanstack/react-query";

export interface AssistantChatFullResponse {
  chat: {
    id: string;
    createdAt: string;
    updatedAt: string;
    profileId: string;
    title: string;
    traceId: string | null;
  } | null;
  messages: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    chatId: string;
    role: "user" | "assistant";
    content: string;
    completed: boolean;
  }>;
  toolCalls: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    chatId: string;
    toolName: string;
    toolType: "create" | "read" | "update" | "delete";
    toolArguments: unknown;
    toolResult: unknown;
    completed: boolean;
  }>;
  allChats: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    profileId: string;
    title: string;
    traceId: string | null;
  }>;
}

/**
 * Hook to fetch complete assistant chat data with all related entities
 * @param chatId - Optional chat ID. If undefined, only fetches the chats list
 * @param profileId - Profile ID to fetch all chats for dropdown
 */
export function useAssistantChatFull(
  chatId: string | undefined,
  profileId: string,
  enabled = true
) {
  return useQuery<AssistantChatFullResponse>({
    queryKey: assistantChatsFullKeys.detail(chatId, profileId),
    queryFn: async () => {
      if (!chatId) {
        // Fetch only the chats list for new chat state
        return api<AssistantChatFullResponse>(
          `/api/v2/assistant/chats/list/${profileId}`
        );
      }
      // Fetch full chat data
      return api<AssistantChatFullResponse>(
        `/api/v2/assistant/chats/${chatId}/full?profile_id=${profileId}`
      );
    },
    enabled: enabled && !!profileId && profileId !== "",
    staleTime: 1000, // 1 second - allow WebSocket updates to trigger refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus since we have WebSocket updates
  });
}
