/**
 * Logs.tsx
 * Used to display the logs page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { log } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppLog, useLogColumns } from "@/hooks/use-log-columns";
import { getAppLogs } from "@/utils/logs/get-logs";
import { LogsDataTable } from "./LogsDataTable";

import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";

export default function Logs() {
  const [selectedLog, setSelectedLog] = useState<AppLog | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: logsData } = useQuery({
    queryKey: ["logs"],
    queryFn: () => getAppLogs({ page: 1, limit: 1000 }), // Get logs for client-side filtering
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["logs"] });
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

  const handleViewLog = (log: AppLog) => {
    setSelectedLog(log);
  };

  const { columns, levelOptions } = useLogColumns({
    onViewLog: handleViewLog,
  });

  return (
    <div className="space-y-6">
      <LogsDataTable
        columns={columns}
        data={logsData ? logsData.logs : []}
        levelOptions={levelOptions}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
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
              <div className="pt-4 pb-4">
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {selectedLog.context
                      ? JSON.stringify(
                          selectedLog.context as Record<string, unknown>,
                          null,
                          2
                        )
                      : "No context data"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
