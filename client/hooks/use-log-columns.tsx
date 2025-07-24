"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatTimestamp,
  getLogLevelVariant,
  truncateText,
} from "@/utils/logs/log-utils";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, FileText } from "lucide-react";

export interface AppLog {
  id: number;
  level: string;
  message: string | null;
  context: unknown;
  createdAt: string | null;
}

export interface UseLogColumnsProps {
  onViewLog: (log: AppLog) => void;
}

export function useLogColumns({ onViewLog }: UseLogColumnsProps) {
  const columns: ColumnDef<AppLog>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("id")}</div>
      ),
    },
    {
      accessorKey: "level",
      header: "Level",
      cell: ({ row }) => {
        const level = row.getValue("level") as string;
        return (
          <Badge variant={getLogLevelVariant(level)}>
            {level.toUpperCase()}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "message",
      header: "Message",
      cell: ({ row }) => {
        const message = row.getValue("message") as string | null;
        const truncated = truncateText(message);
        const hasMore = message && message.length > 100;

        return (
          <div className="flex items-center gap-2">
            <span className="truncate max-w-md">{truncated}</span>
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewLog(row.original)}
                className="h-6 w-6 p-0"
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const message = row.getValue(id) as string | null;
        if (!message) return false;
        return message.toLowerCase().includes(value.toLowerCase());
      },
    },
    {
      accessorKey: "context",
      header: "Context",
      cell: ({ row }) => {
        const context = row.getValue("context");
        return context ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewLog(row.original)}
            className="h-8 px-2"
          >
            <FileText className="h-3 w-3 mr-1" />
            View JSON
          </Button>
        ) : (
          <span className="text-muted-foreground">None</span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => (
        <div className="text-sm">
          {formatTimestamp(row.getValue("createdAt"))}
        </div>
      ),
    },
  ];

  // Filter options for level
  const levelOptions = [
    { value: "error", label: "Error" },
    { value: "warn", label: "Warning" },
    { value: "info", label: "Info" },
    { value: "debug", label: "Debug" },
  ];

  return {
    columns,
    levelOptions,
  };
}
