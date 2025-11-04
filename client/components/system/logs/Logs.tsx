/**
 * Logs.tsx
 * Used to display the logs page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { useProfile } from "@/contexts/profile-context";
import type { LogItem } from "@/lib/api/v2/schemas/logs";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BulkDeleteLogsDialog } from "./BulkDeleteLogsDialog";
import { LogsDataTable } from "./LogsDataTable";

import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function Logs() {
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const queryClient = useQueryClient();
  const { effectiveProfile } = useProfile();

  // V3 API hook (read-only)
  const filters = { profileId: effectiveProfile?.id || "" };
  const { data: logsData, isLoading } = useQuery({
    queryKey: keys.logs.list(filters),
    queryFn: () => api.post("/logs/list", { body: filters }),
    enabled: !!effectiveProfile?.id,
  });

  // Extract and normalize data from V3 response to match v2 LogItem type
  const logs = useMemo(() => {
    if (!logsData?.logs) return [];

    return logsData.logs.map((log) => ({
      ...log,
      // Convert log_id from string to number (v2 expects number)
      log_id: Number.parseInt(log.log_id, 10) || 0,
      // Ensure correlation_id is always a string (v2 expects non-nullable)
      correlation_id: log.correlation_id ?? "",
      // Ensure actor_name can be null (v2 expects nullable)
      actor_name: log.actor_name || null,
      // Ensure actor can be null (v2 expects nullable)
      actor: log.actor || null,
      // Ensure subject can be null
      subject: log.subject || null,
      // Ensure context can be null
      context: log.context || null,
      // Ensure error can be null
      error: log.error || null,
    }));
  }, [logsData?.logs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: keys.logs.all });
      toast.success("Logs refreshed successfully");
    } catch {
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
      { value: "error", label: "Error" },
      { value: "warn", label: "Warn" },
      { value: "info", label: "Info" },
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
    dateOptions,
    timeOptions,
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
    const dates = new Set<string>();
    const hours = new Set<number>();

    logs.forEach((logItem) => {
      if (logItem.created_at) {
        const date = new Date(logItem.created_at);
        // Format as MM/DD for date options
        const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
        dates.add(dateStr);
        hours.add(date.getHours());
      }
    });

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
      dateOptions: Array.from(dates)
        .sort()
        .map((d) => ({ value: d, label: d })),
      timeOptions: Array.from(hours)
        .sort((a, b) => a - b)
        .map((h) => ({
          value: String(h),
          label: `${String(h).padStart(2, "0")}:00`,
        })),
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
        dateOptions={dateOptions}
        timeOptions={timeOptions}
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
