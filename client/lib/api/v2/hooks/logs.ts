/**
 * Logs hooks for v2 API
 * Provides useLogger hook that automatically includes profile context
 */

import { useProfile } from "@/contexts/profile-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../fetcher";
import { logsListKeys } from "../keys";
import { HealthResponseSchema } from "../schemas/health";
import {
  BulkDeleteLogsResponseSchema,
  LogsListResponseSchema,
} from "../schemas/logs";

/**
 * Create log mutation hook
 * Use this to send logs to the BFF endpoint
 */
export function useCreateLog() {
  return useMutation({
    mutationFn: async (entry: {
      event: string;
      level: "debug" | "info" | "warn" | "error";
      message?: string;
      actor?: { userId?: string; profileId?: string };
      subject?: { entityType?: string; entityId?: string };
      context?: Record<string, unknown>;
      error?: unknown;
    }) => {
      await api("/api/v2/logs/create", {
        method: "POST",
        body: JSON.stringify(entry),
      });
    },
  });
}

/**
 * Logger hook that automatically includes the current profile as actor
 * Use this in components for automatic context injection
 */
export function useLogger() {
  const { effectiveProfile } = useProfile();
  const createLog = useCreateLog();

  return {
    info: (
      event: string,
      rest: {
        message?: string;
        subject?: { entityType?: string; entityId?: string };
        context?: Record<string, unknown>;
      }
    ) =>
      createLog.mutate({
        event,
        level: "info",
        actor: { profileId: effectiveProfile?.id || "" },
        ...rest,
      }),
    warn: (
      event: string,
      rest: {
        message?: string;
        subject?: { entityType?: string; entityId?: string };
        context?: Record<string, unknown>;
      }
    ) =>
      createLog.mutate({
        event,
        level: "warn",
        actor: { profileId: effectiveProfile?.id || "" },
        ...rest,
      }),
    error: (
      event: string,
      rest: {
        message?: string;
        subject?: { entityType?: string; entityId?: string };
        context?: Record<string, unknown>;
        error?: unknown;
      }
    ) =>
      createLog.mutate({
        event,
        level: "error",
        actor: { profileId: effectiveProfile?.id || "" },
        ...rest,
      }),
    debug: (
      event: string,
      rest: {
        message?: string;
        subject?: { entityType?: string; entityId?: string };
        context?: Record<string, unknown>;
      }
    ) =>
      createLog.mutate({
        event,
        level: "debug",
        actor: { profileId: effectiveProfile?.id || "" },
        ...rest,
      }),
  };
}

// Type for cohorts hook options
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

/**
 * Bulk delete logs mutation hook
 * Only superadmin users can delete logs
 */
export function useBulkDeleteLogs() {
  const { effectiveProfile } = useProfile();

  return useMutation({
    mutationFn: async (request: { ids: number[] }) => {
      const res = await api<unknown>("/api/v2/logs/bulk-delete", {
        method: "POST",
        body: JSON.stringify({
          profileId: effectiveProfile?.id,
          ids: request.ids,
        }),
      });

      return BulkDeleteLogsResponseSchema.parse(res);
    },
  });
}

/**
 * System health check hook
 * Auto-refreshes every 30 seconds for real-time monitoring
 */
export function useSystemHealth(options?: {
  enabled?: boolean;
  refetchInterval?: number; // Default 30 seconds
}) {
  return useQuery({
    queryKey: ["health", "system"],
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/logs/health");
      return HealthResponseSchema.parse(res);
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? 30000,
    staleTime: 10000,
  });
}
