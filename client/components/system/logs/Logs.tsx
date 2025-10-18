/**
 * Logs.tsx
 * Used to display the logs page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { useProfile } from "@/contexts/profile-context";
import type { LogItem } from "@/lib/api/v2/schemas/logs";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { DateRange } from "react-day-picker";
import { BulkDeleteLogsDialog } from "./BulkDeleteLogsDialog";
import { LogsDataTable } from "./LogsDataTable";

import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLogsList, useLogger } from "@/lib/api/v2/hooks/logs";

export default function Logs() {
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const queryClient = useQueryClient();
  const { effectiveProfile } = useProfile();
  const log = useLogger();
  // V2 API hook
  const profileId = effectiveProfile?.id || "";
  const { data: logsData, isLoading } = useLogsList(profileId, !!profileId);

  // Extract data from V2 response
  const logs = useMemo(() => logsData?.logs || [], [logsData?.logs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("logs:v2:list");
        },
      });
      log.info("logs.refresh.success", {
        message: "Logs refreshed successfully",
        context: { component: "Logs" },
      });
      toast.success("Logs refreshed successfully");
    } catch (error) {
      log.error("logs.refresh.failed", {
        message: "Error refreshing logs",
        error,
        context: { component: "Logs" },
      });
      toast.error("Failed to refresh logs");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewLog = (logItem: LogItem) => {
    setSelectedLog(logItem);
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteSuccess = () => {
    // The query will be invalidated by the mutation hook
    // Dialog will close automatically after successful deletion
  };

  // Filter options using V2 typed JSONB fields
  const levelOptions = useMemo(
    () => [
      { value: "info", label: "Info" },
      { value: "warn", label: "Warn" },
      { value: "error", label: "Error" },
      { value: "debug", label: "Debug" },
    ],
    []
  );

  const {
    eventOptions,
    providerOptions,
    modelOptions,
    actorOptions,
    componentOptions,
    functionOptions,
  } = useMemo(() => {
    const events = new Set(logs.map((l) => l.event));
    const providers = new Set(
      logs.map((l) => l.context?.provider).filter(Boolean)
    );
    const models = new Set(logs.map((l) => l.context?.model).filter(Boolean));
    const actors = new Set(logs.map((l) => l.actor_name).filter(Boolean));
    const components = new Set(
      logs.map((l) => l.context?.component).filter(Boolean)
    );
    const functions = new Set(
      logs.map((l) => l.context?.function).filter(Boolean)
    );

    return {
      eventOptions: Array.from(events)
        .sort()
        .map((v) => ({ value: v, label: v })),
      providerOptions: Array.from(providers)
        .sort()
        .map((v) => ({ value: v!, label: v! })),
      modelOptions: Array.from(models)
        .sort()
        .map((v) => ({ value: v!, label: v! })),
      actorOptions: Array.from(actors)
        .sort()
        .map((v) => ({ value: v!, label: v! })),
      componentOptions: Array.from(components)
        .sort()
        .map((v) => ({ value: v!, label: v! })),
      functionOptions: Array.from(functions)
        .sort()
        .map((v) => ({ value: v!, label: v! })),
    };
  }, [logs]);

  if (isLoading) {
    return <div className="text-center p-6">Loading logs...</div>;
  }

  return (
    <div className="space-y-6">
      <LogsDataTable
        data={logs}
        levelOptions={levelOptions}
        eventOptions={eventOptions}
        providerOptions={providerOptions}
        modelOptions={modelOptions}
        actorOptions={actorOptions}
        componentOptions={componentOptions}
        functionOptions={functionOptions}
        dateRange={dateRange}
        setDateRange={setDateRange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onBulkDelete={handleBulkDelete}
        onViewLog={handleViewLog}
      />

      {/* Detail Dialog */}
      <Dialog
        open={selectedLog !== null}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogDescription hidden>
            This dialog shows the log details.
          </DialogDescription>
          <div className="space-y-4">
            {selectedLog && (
              <div className="pt-4 pb-4 space-y-3">
                {/* Render a compact overview */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Event:</span>{" "}
                    {selectedLog.event}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Level:</span>{" "}
                    {selectedLog.level}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {selectedLog.created_at ?? ""}
                  </div>
                  {selectedLog.correlation_id && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">
                        Correlation:
                      </span>{" "}
                      <span className="font-mono">
                        {selectedLog.correlation_id}
                      </span>
                    </div>
                  )}
                </div>

                {/* Full JSON */}
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-xs font-mono">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <BulkDeleteLogsDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        logs={logs}
        onSuccess={handleBulkDeleteSuccess}
      />
    </div>
  );
}
