/**
 * Logs.tsx
 * Used to display the logs page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { logError, logInfo } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLog, useLogColumns } from "@/hooks/use-log-columns";
import { getAppLogs } from "@/utils/logs/get-logs";
import { LogsDataTable } from "./LogsDataTable";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatTimestamp, getLogLevelVariant } from "@/utils/logs/log-utils";

export default function Logs() {
  const [selectedLog, setSelectedLog] = useState<AppLog | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: logsData, isLoading: loadingAppLogs } = useQuery({
    queryKey: ["logs"],
    queryFn: () => getAppLogs({ page: 1, limit: 1000 }), // Get all logs for client-side filtering
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["logs"] });
      logInfo("Logs refreshed successfully");
      toast.success("Logs refreshed successfully");
    } catch (error) {
      logError("Error refreshing logs:", error);
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

  if (loadingAppLogs) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application Logs
              </CardTitle>
              <CardDescription>
                System logs and application events
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Loading logs...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!logsData || !logsData.logs || logsData.logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application Logs
              </CardTitle>
              <CardDescription>
                System logs and application events
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-lg text-muted-foreground">No logs found</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { logs, totalCount } = logsData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application Logs
              </CardTitle>
              <CardDescription>
                System logs and application events ({totalCount} total)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <LogsDataTable
            columns={columns}
            data={logs}
            levelOptions={levelOptions}
          />
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog
        open={selectedLog !== null}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="space-y-4">
            {selectedLog && (
              <>
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Badge variant={getLogLevelVariant(selectedLog.level)}>
                    {selectedLog.level.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ID: {selectedLog.id}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatTimestamp(selectedLog.createdAt)}
                  </span>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Message</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="whitespace-pre-wrap text-sm">
                      {selectedLog.message || "No message"}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Context</h4>
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
