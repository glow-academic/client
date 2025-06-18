/**
 * Logs.tsx
 * Used to display the logs page with all created logs and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllAppLogs } from "@/utils/queries/app_logs/get-all-app-logs";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText } from "lucide-react";
import { useState } from "react";

interface AppLog {
  id: number;
  level: string;
  message: string | null;
  context: unknown;
  createdAt: string | null;
}

export default function Logs() {
  const [selectedLog, setSelectedLog] = useState<AppLog | null>(null);

  const { data: appLogs, isLoading: loadingAppLogs } = useQuery({
    queryKey: ["appLogs"],
    queryFn: () => getAllAppLogs(),
  });

  const getLogLevelVariant = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return "destructive";
      case "warn":
      case "warning":
        return "secondary";
      case "info":
        return "default";
      case "debug":
        return "outline";
      default:
        return "default";
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const truncateText = (text: string | null, maxLength: number = 100) => {
    if (!text) return "N/A";
    return text.length > maxLength
      ? `${text.substring(0, maxLength)}...`
      : text;
  };

  const openDialog = (log: AppLog, type: "message" | "context") => {
    setSelectedLog(log);
    setDialogType(type);
  };

  if (loadingAppLogs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading logs...</div>
      </div>
    );
  }

  if (!appLogs || appLogs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">No logs found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead className="w-[100px]">Level</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-[120px]">Context</TableHead>
              <TableHead className="w-[180px]">Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appLogs.map((log: AppLog) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.id}</TableCell>
                <TableCell>
                  <Badge variant={getLogLevelVariant(log.level)}>
                    {log.level.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <div className="flex items-center gap-2">
                    <span className="truncate">
                      {truncateText(log.message)}
                    </span>
                    {log.message && log.message.length > 100 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDialog(log, "message")}
                        className="h-6 w-6 p-0"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {log.context ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDialog(log, "context")}
                      className="h-8 px-2"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      View JSON
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {formatTimestamp(log.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Message Dialog */}
      <Dialog
        open={dialogType === "message" && selectedLog !== null}
        onOpenChange={(open) => !open && setDialogType(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Details - ID: {selectedLog?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Level:</h4>
              <Badge
                variant={
                  selectedLog
                    ? getLogLevelVariant(selectedLog.level)
                    : "default"
                }
              >
                {selectedLog?.level.toUpperCase()}
              </Badge>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Message:</h4>
              <div className="bg-muted p-3 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm">
                  {selectedLog?.message || "No message"}
                </pre>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Created At:</h4>
              <p className="text-sm">
                {selectedLog && formatTimestamp(selectedLog.createdAt)}
              </p>
            </div>
            {selectedLog && selectedLog.context && (
              <div>
                <h4 className="font-semibold mb-2">Context:</h4>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="whitespace-pre-wrap text-sm">
                    {selectedLog.context
                      ? JSON.stringify(
                          selectedLog.context as Record<string, unknown>,
                          null,
                          2
                        )
                      : "No context data"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Context Dialog */}
      <Dialog
        open={selectedLog !== null}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Context Data - Log ID: {selectedLog?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">JSON Context:</h4>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {selectedLog?.context
                    ? JSON.stringify(
                        selectedLog.context as Record<string, unknown>,
                        null,
                        2
                      )
                    : "No context data"}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
