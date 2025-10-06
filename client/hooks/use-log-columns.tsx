"use client";

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimestamp, getLogLevelVariant } from "@/utils/logs/log-utils";
import { ColumnDef } from "@tanstack/react-table";
import { FileText } from "lucide-react";

export interface AppLog {
  id: number;
  event: string;
  level: string;
  message: string | null;
  correlationId: string | null;
  actor: unknown;
  subject: unknown;
  metrics: unknown;
  context: unknown;
  error: unknown;
  createdAt: string | null;
}

export interface UseLogColumnsProps {
  onViewLog: (log: AppLog) => void;
  resolveActorName?: (
    actor: Record<string, unknown> | null | undefined,
  ) => string | null;
}

export function useLogColumns({
  onViewLog,
  resolveActorName,
}: UseLogColumnsProps) {
  const columns: ColumnDef<AppLog>[] = [
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          {formatTimestamp(row.getValue("createdAt"))}
        </div>
      ),
      enableSorting: true,
      // Accepts a DateRange-like value { from?: Date; to?: Date }
      filterFn: (row, id, value) => {
        if (!value || (!value.from && !value.to)) return true;
        const created = row.getValue(id) as string | null;
        if (!created) return false;
        const createdMs = new Date(created).getTime();
        const fromMs = value?.from ? new Date(value.from).getTime() : undefined;
        const toMs = value?.to ? new Date(value.to).getTime() : undefined;
        if (fromMs && createdMs < fromMs) return false;
        if (toMs && createdMs > toMs) return false;
        return true;
      },
    },
    {
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("id")}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "event",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Event" />
      ),
      cell: ({ row }) => {
        const event = row.getValue("event") as string;
        return <span className="truncate max-w-xs inline-block">{event}</span>;
      },
      // Faceted multi-select will provide an array of selected values
      filterFn: (row, id, value) => {
        if (!value || value.length === 0) return true;
        const event = (row.getValue(id) as string) ?? "";
        return value.includes(event);
      },
      enableSorting: true,
    },
    {
      accessorKey: "level",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Level" />
      ),
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
      enableSorting: true,
    },
    {
      id: "actor",
      accessorFn: (row) => {
        const actor = (row.actor ?? null) as Record<string, unknown> | null;
        const resolved = resolveActorName?.(actor);
        if (resolved) return resolved;
        const profileName = actor?.["profileName"] as string | undefined;
        const profileId = actor?.["profileId"] as string | undefined;
        const userId = actor?.["userId"] as string | undefined;
        return profileName ?? profileId ?? userId ?? null;
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Actor" />
      ),
      cell: ({ row }) => {
        const actorLabel = (row.getValue("actor") as string | null) ?? null;
        return actorLabel ? (
          <span className="font-mono text-xs">{actorLabel}</span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0) return true;
        const v = (row.getValue(id) as string | null) ?? "";
        return value.includes(v);
      },
      enableSorting: true,
    },
    {
      accessorKey: "message",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Message" />
      ),
      cell: ({ row }) => {
        const message = row.getValue("message") as string | null;
        return (
          <div className="max-w-[200px] overflow-x-auto">
            <span className="whitespace-nowrap text-sm">
              {message ?? "N/A"}
            </span>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const message = row.getValue(id) as string | null;
        if (!message) return false;
        return message.toLowerCase().includes(value.toLowerCase());
      },
      enableSorting: true,
    },
    {
      id: "component",
      accessorFn: (row) =>
        ((row.context ?? null) as Record<string, unknown> | null)?.[
          "component"
        ] ?? null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Component" />
      ),
      cell: ({ row }) => {
        const v = (row.getValue("component") as string | null) ?? null;
        return v ? v : <span className="text-muted-foreground">N/A</span>;
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0) return true;
        const v = (row.getValue(id) as string | null) ?? "";
        return value.includes(v);
      },
      enableSorting: true,
    },
    {
      id: "function",
      accessorFn: (row) =>
        ((row.context ?? null) as Record<string, unknown> | null)?.[
          "function"
        ] ?? null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Function" />
      ),
      cell: ({ row }) => {
        const v = (row.getValue("function") as string | null) ?? null;
        return v ? v : <span className="text-muted-foreground">N/A</span>;
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0) return true;
        const v = (row.getValue(id) as string | null) ?? "";
        return value.includes(v);
      },
      enableSorting: true,
    },
    // Removed hasError column per request
    {
      accessorKey: "correlationId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Correlation" />
      ),
      cell: ({ row }) => {
        const corr = (row.getValue("correlationId") as string | null) ?? "";
        return (
          <span className="font-mono text-xs truncate inline-block max-w-[160px]">
            {corr}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      id: "durationMs",
      accessorFn: (row) => {
        const metrics = row.metrics as Record<string, unknown> | null;
        return (metrics?.["durationMs"] as number | undefined) ?? null;
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Duration (ms)" />
      ),
      cell: ({ row }) => {
        const dur = row.getValue("durationMs") as number | null;
        return dur != null ? (
          `${dur}`
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
      enableSorting: true,
    },
    {
      id: "provider",
      accessorFn: (row) =>
        (((row.context ?? null) as Record<string, unknown> | null)?.[
          "provider"
        ] as string | undefined) ?? null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Provider" />
      ),
      cell: ({ row }) => {
        const provider = (row.getValue("provider") as string | null) ?? null;
        return provider ? (
          provider
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0) return true;
        const v = (row.getValue(id) as string | null) ?? "";
        return value.includes(v);
      },
      enableSorting: true,
    },
    {
      id: "model",
      accessorFn: (row) =>
        (((row.context ?? null) as Record<string, unknown> | null)?.[
          "model"
        ] as string | undefined) ?? null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Model" />
      ),
      cell: ({ row }) => {
        const model = (row.getValue("model") as string | null) ?? null;
        return model ? (
          model
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0) return true;
        const v = (row.getValue(id) as string | null) ?? "";
        return value.includes(v);
      },
      enableSorting: true,
    },
    {
      accessorKey: "context",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Context" />
      ),
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
      enableSorting: true,
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
