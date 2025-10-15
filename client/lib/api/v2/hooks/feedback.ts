/**
 * Feedback hooks for v2 API
 * Hooks for fetching feedback list and creating feedback
 */

import { api } from "@/lib/api/fetcher";
import { feedbackListKeys } from "@/lib/api/v2/keys";
import {
  CreateFeedbackRequest,
  CreateFeedbackResponseSchema,
  FeedbackListResponseSchema,
} from "@/lib/api/v2/schemas/feedback";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for feedback hook options
type FeedbackHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useFeedbackList(
  profileId: string,
  options: FeedbackHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: feedbackListKeys.list(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/feedback/list", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return FeedbackListResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}

export function useCreateFeedbackV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFeedbackRequest) => {
      const res = await api<unknown>("/api/v2/feedback/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return CreateFeedbackResponseSchema.parse(res);
    },
    onSuccess: () => {
      // Invalidate v2 feedback list cache if it exists
      qc.invalidateQueries({ queryKey: feedbackListKeys.all });
    },
  });
}
