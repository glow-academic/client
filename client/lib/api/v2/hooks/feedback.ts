/**
 * Feedback hooks for v2 API
 * Read-only hook for fetching feedback list
 */

import { api } from "@/lib/api/fetcher";
import { feedbackListKeys } from "@/lib/api/v2/keys";
import { FeedbackListResponseSchema } from "@/lib/api/v2/schemas/feedback";
import { useQuery } from "@tanstack/react-query";

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
