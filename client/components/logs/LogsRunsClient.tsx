"use client";

/**
 * LogsRunsClient.tsx
 * Logs table component for system logs.
 * This component is wrapped in Suspense and remounts when logsKey changes.
 */

import type {
  BulkDeleteLogsIn,
  BulkDeleteLogsOut,
  LogsRunsOut,
} from "@/app/(main)/system/health/page";
import LogsTable from "./LogsTable";

interface LogsRunsClientProps {
  runsData: LogsRunsOut;
  isLoading: boolean;
  bulkDeleteLogsAction: (input: BulkDeleteLogsIn) => Promise<BulkDeleteLogsOut>;
}

export function LogsRunsClient({
  runsData,
  isLoading,
  bulkDeleteLogsAction,
}: LogsRunsClientProps) {
  return (
    <LogsTable
      runsData={runsData}
      isLoading={isLoading}
      bulkDeleteLogsAction={bulkDeleteLogsAction}
    />
  );
}
