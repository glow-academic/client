/**
 * Logs hooks for v2 API
 * Read-only hook for fetching logs list with comprehensive JSONB data
 */

import { api } from "@/lib/api/fetcher";
import { logsListKeys } from "@/lib/api/v2/keys";
import { LogsListResponseSchema } from "@/lib/api/v2/schemas/logs";
import { useQuery } from "@tanstack/react-query";

// Type for logs hook options
type LogsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useLogsList(
  profileId: string,
  options: LogsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: logsListKeys.list(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/logs/list", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return LogsListResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}
