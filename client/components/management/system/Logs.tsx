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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAppLogs } from "@/utils/logs/get-logs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

interface AppLog {
  id: number;
  level: string;
  message: string | null;
  context: unknown;
  createdAt: string | null;
}

interface LogsResponse {
  logs: AppLog[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export default function Logs() {
  const [selectedLog, setSelectedLog] = useState<AppLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: logsData, isLoading: loadingAppLogs } = useQuery<LogsResponse>({
    queryKey: ["logs", currentPage],
    queryFn: () => getAppLogs({ page: currentPage, limit: 25 }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["logs"] });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

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

  const openDialog = (log: AppLog) => {
    setSelectedLog(log);
  };

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

  const { logs, totalCount, totalPages, hasNextPage, hasPreviousPage } =
    logsData;

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
      <CardContent className="space-y-4">
        {/* Pagination Info */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * 25 + 1} to{" "}
            {Math.min(currentPage * 25, totalCount)} of {totalCount} logs
          </div>
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        {/* Logs Table - Scrollable */}
        <div className="border rounded-lg max-h-96 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead className="w-[100px]">Level</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[120px]">Context</TableHead>
                <TableHead className="w-[180px]">Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: AppLog) => (
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
                          onClick={() => openDialog(log)}
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
                        onClick={() => openDialog(log)}
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

        {/* Pagination Controls */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPreviousPage}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {/* Show page numbers around current page */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(1, currentPage - 2);
              const pageNum = startPage + i;

              if (pageNum > totalPages) return null;

              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(pageNum)}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              );
            }).filter(Boolean)}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

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
      </CardContent>
    </Card>
  );
}
