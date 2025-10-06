"use client";

import { Table } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { log } from "@/utils/logger";
import { toast } from "sonner";

// Define proper types for the data structures
interface ChatData {
  id: string;
  completed: boolean;
  hasRubric?: boolean;
  score?: number;
}

interface AttemptData {
  interactionIds?: string[];
  chats?: ChatData[];
}

// TAPerformanceData interface for Reports page
interface TAPerformanceData {
  firstName: string;
  lastName: string;
  username: string;
  avgScore: number;
  completedSessions: number;
  totalSessions: number;
  passRate: number;
  avgTimeMinutes: number;
  completionRate: number;
  trend: "improving" | "declining" | "stable";
  lastActivity: Date | null;
  scenariosCompleted: number;
  messagesPerSession: number;
  totalAttempts: number;
  taCohorts: string[];
  isStruggling: boolean;
  hasNoSessions: boolean;
  [key: string]: unknown;
}

type ExportableData = ChatData | AttemptData;

// Column name mapping for CSV export
const columnMap = {
  createdAt: "Date",
  userId: "Name",
  profileId: "Name",
  persona: "Persona",
  title: "Title",
  simulationId: "Simulation",
  status: "Status",
  score: "Score",
  averageScore: "Score",
  scenarios: "Scenarios",
  personasTested: "Personas",
  // Reports page columns
  firstName: "Name",
  username: "Alias",
  avgScore: "Score",
  totalSessions: "Sessions",
  passRate: "Pass Rate",
  avgTimeMinutes: "Avg Time (min)",
  completionRate: "Completion Rate",
  trend: "Trend",
  lastActivity: "Last Activity",
  scenariosCompleted: "Scenarios",
  messagesPerSession: "Messages/Session",
  totalAttempts: "Total Attempts",
  taCohorts: "Cohorts",
  isStruggling: "Status",
};

// Helper function to determine chat status
const getStatusLabel = (chat: ExportableData, statusValue?: string): string => {
  if (statusValue) {
    return statusValue;
  }

  const chatData = chat as ChatData;
  if (chatData.hasRubric || (chatData.score && chatData.score > 0)) {
    return "Completed";
  } else if (chatData.completed) {
    return "Grading";
  } else {
    return "In Progress";
  }
};

// Maximum rows to export without confirmation
const MAX_ROWS_WITHOUT_CONFIRM = 100;

export interface ExportButtonProps<TData> {
  table: Table<TData>;
  profileOptions: { value: string; label: string }[];
}

export function ExportButton<TData>({
  table,
  profileOptions,
}: ExportButtonProps<TData>) {
  const selectedRows = Object.keys(table.getState().rowSelection).length;
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false);

  // Function to export selected rows to CSV
  const handleExportToCSV = () => {
    try {
      // Get all checked rows
      const selectedData =
        selectedRows > 0
          ? table.getFilteredSelectedRowModel().rows
          : table.getFilteredRowModel().rows;

      // Get visible columns (except 'actions' column)
      const visibleColumns = table
        .getVisibleLeafColumns()
        .filter((col) => col.id !== "actions" && col.id !== "select");

      // Create CSV header based on visible column headers with proper mapping
      const headerRow = visibleColumns
        .map((column) => {
          return columnMap[column.id as keyof typeof columnMap] || column.id;
        })
        .join(",");

      // Create CSV rows from selected data
      const csvRows = selectedData.map((row) => {
        return visibleColumns
          .map((column) => {
            // Get cell value, handle different data types
            const cellValue = row.getValue(column.id);

            // Special handling for specific column types
            if (column.id === "createdAt" && cellValue) {
              const date = new Date(cellValue as string);
              return `"${date.toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}"`;
            }

            // Special handling for status column
            if (column.id === "status") {
              const original = row.original as ExportableData;
              return `"${getStatusLabel(original)}"`;
            }

            if (column.id === "classCode" && cellValue) {
              return `"${cellValue}"`;
            }

            if (column.id === "chats" && cellValue) {
              const chats = cellValue as ChatData[];
              const original = row.original as AttemptData;
              const interactionIds = original.interactionIds as string[];

              // Ensure chats is an array
              const chatsArray = Array.isArray(chats) ? chats : [];

              const completedChats =
                chatsArray.filter((chat) => chat.completed).length || 0;
              // Use simulation's interactionIds length for total expected chats
              const totalChats =
                interactionIds?.length || chatsArray.length || 0;
              return `"${completedChats}/${totalChats}"`;
            }

            if (column.id === "personasTested" && cellValue) {
              const personas = cellValue as string[];

              // Ensure personas is an array
              const personasArray = Array.isArray(personas) ? personas : [];
              return `"${personasArray.join(", ")}"`;
            }

            if (column.id === "averageScore" && cellValue) {
              return `"${Number(cellValue).toFixed(1)}"`;
            }

            if (column.id === "profileId" && cellValue) {
              const profileOption = profileOptions.find(
                (profile) => profile.value === cellValue,
              );
              return profileOption
                ? `"${profileOption.label}"`
                : `"${cellValue}"`;
            }

            // Reports page specific handling
            if (column.id === "firstName" && cellValue) {
              const original = row.original as TAPerformanceData;
              return `"${original.firstName} ${original.lastName}"`;
            }

            if (column.id === "username" && cellValue) {
              return `"${cellValue}"`;
            }

            if (column.id === "avgScore" && cellValue !== undefined) {
              const original = row.original as TAPerformanceData;
              return original.hasNoSessions ? '"N/A"' : `"${cellValue}%"`;
            }

            if (column.id === "totalSessions" && cellValue !== undefined) {
              const original = row.original as TAPerformanceData;
              return `"${original.completedSessions}/${cellValue}"`;
            }

            if (column.id === "passRate" && cellValue !== undefined) {
              const original = row.original as TAPerformanceData;
              return original.hasNoSessions ? '"N/A"' : `"${cellValue}%"`;
            }

            if (column.id === "avgTimeMinutes" && cellValue !== undefined) {
              const original = row.original as TAPerformanceData;
              return original.hasNoSessions ? '"N/A"' : `"${cellValue} min"`;
            }

            if (column.id === "completionRate" && cellValue !== undefined) {
              return `"${cellValue}%"`;
            }

            if (column.id === "trend" && cellValue) {
              const trendMap = {
                improving: "Improving",
                declining: "Declining",
                stable: "Stable",
              };
              return `"${trendMap[cellValue as keyof typeof trendMap] || cellValue}"`;
            }

            if (column.id === "lastActivity" && cellValue) {
              const date = new Date(cellValue as string);
              return `"${date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}"`;
            }

            if (column.id === "scenariosCompleted" && cellValue !== undefined) {
              return `"${cellValue}"`;
            }

            if (column.id === "messagesPerSession" && cellValue !== undefined) {
              const original = row.original as TAPerformanceData;
              return original.hasNoSessions ? '"N/A"' : `"${cellValue}"`;
            }

            if (column.id === "totalAttempts" && cellValue !== undefined) {
              return `"${cellValue}"`;
            }

            if (column.id === "taCohorts" && cellValue) {
              const cohorts = cellValue as string[];
              return `"${cohorts.join(", ")}"`;
            }

            if (column.id === "isStruggling" && cellValue !== undefined) {
              const original = row.original as TAPerformanceData;
              if (original.hasNoSessions) return '"No Sessions"';
              return cellValue ? '"At Risk"' : '"Good"';
            }

            // Handle string values that might contain commas
            if (typeof cellValue === "string") {
              return `"${cellValue.replace(/"/g, '""')}"`;
            }

            // Handle other types
            return cellValue !== null && cellValue !== undefined
              ? String(cellValue)
              : "";
          })
          .join(",");
      });

      // Combine header and rows
      const csvData = [headerRow, ...csvRows].join("\n");

      // Create a Blob for the CSV
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });

      // Create a temporary link element to download the file
      const today = new Date();
      // Determine filename based on data type
      const isReportsData =
        selectedData.length > 0 &&
        selectedData[0]?.original &&
        "firstName" in (selectedData[0].original as Record<string, unknown>);
      const filename = isReportsData
        ? `ta_reports_export_${today.toISOString().slice(0, 10)}.csv`
        : `simulations_export_${today.toISOString().slice(0, 10)}.csv`;

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast?.success(`Exported ${selectedData.length} rows to CSV`);
      setExportPopoverOpen(false);
    } catch (error) {
      log.error("export.csv.failed", {
        message: "Error exporting to CSV",
        error,
        context: { component: "ExportButton" },
      });
      toast?.error("Failed to export data");
    }
  };

  // Function to prepare for export
  const prepareExport = () => {
    const rowCount =
      selectedRows > 0
        ? table.getFilteredSelectedRowModel().rows.length
        : table.getFilteredRowModel().rows.length;

    if (rowCount > MAX_ROWS_WITHOUT_CONFIRM) {
      // For large exports, show confirmation (could be implemented later)
      handleExportToCSV();
    } else {
      handleExportToCSV();
    }
  };

  return (
    <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export {selectedRows > 0 ? `(${selectedRows})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-4" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Export Options</h4>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-2">
              {selectedRows > 0
                ? `Exporting ${selectedRows} selected rows`
                : "Exporting all filtered rows"}
            </div>
            <p className="text-xs text-muted-foreground">
              Exports currently visible columns with proper formatting.
            </p>
            <div className="pt-2 flex justify-end">
              <Button size="sm" className="w-full" onClick={prepareExport}>
                Export to CSV
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
