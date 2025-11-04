/**
 * V2 API hooks for attempts
 * Server-side computed data for simulation attempts
 */

import { api } from "@/lib/api/v2/fetcher";
import { attemptsFullKeys } from "@/lib/api/v2/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AttemptFullResponse,
  BulkArchiveAttemptsRequest,
  BulkArchiveAttemptsResponse,
  UpdateChatCompletedAtRequest,
  UpdateChatCreatedAtRequest,
  UpdateChatTimestampResponseSchema,
} from "../schemas/attempts";
import { useRefreshAnalytics } from "./analytics";

export function useAttemptFull(attemptId: string) {
  return useQuery<AttemptFullResponse>({
    queryKey: attemptsFullKeys.detail(attemptId),
    queryFn: () =>
      api<AttemptFullResponse>(`/api/v2/attempts/${attemptId}/full`),
    enabled: Boolean(attemptId),
    staleTime: 1000, // 1 second - allow WebSocket updates to trigger refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus since we have active polling
  });
}

export function useBulkArchiveAttempts() {
  const qc = useQueryClient();
  const { mutate: refreshAnalytics } = useRefreshAnalytics();

  return useMutation({
    mutationFn: (request: BulkArchiveAttemptsRequest) =>
      api<BulkArchiveAttemptsResponse>("/api/v2/attempts/bulk-archive", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    onSuccess: () => {
      // Invalidate v2 attempts
      qc.invalidateQueries({ queryKey: attemptsFullKeys.all });
      // Refresh analytics MV
      refreshAnalytics();
    },
  });
}

export function useUpdateChatCreatedAt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateChatCreatedAtRequest) => {
      const res = await api<unknown>(
        "/api/v2/attempts/chats/update-created-at",
        {
          method: "POST",
          body: JSON.stringify(request),
        }
      );
      return UpdateChatTimestampResponseSchema.parse(res);
    },
    onSuccess: () => {
      // Invalidate v2 attempts to refetch updated data
      queryClient.invalidateQueries({
        queryKey: attemptsFullKeys.all,
      });
    },
  });
}

export function useUpdateChatCompletedAt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateChatCompletedAtRequest) => {
      const res = await api<unknown>(
        "/api/v2/attempts/chats/update-completed-at",
        {
          method: "POST",
          body: JSON.stringify(request),
        }
      );
      return UpdateChatTimestampResponseSchema.parse(res);
    },
    onSuccess: () => {
      // Invalidate v2 attempts to refetch updated data
      queryClient.invalidateQueries({
        queryKey: attemptsFullKeys.all,
      });
    },
  });
}
