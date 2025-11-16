"use client";

import { Table } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { ExportPicker } from "@/components/common/forms/ExportPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AnalyticsFilters } from "@/utils/analytics-filters";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import { toast } from "sonner";

interface ReportsDataItem {
  profile_id: string;
  profileName: string;
  profileAlias: string;
  scenario_id?: string;
  simulation_id?: string;
  [key: string]: unknown;
}

export interface ExportButtonProps<TData> {
  table: Table<TData>;
  simulations?: Array<{ id: string; title: string }>;
}

export function ExportButton<TData>({
  table,
  simulations,
}: ExportButtonProps<TData>) {
  const searchParams = useSearchParams();
  const selectedRows = Object.keys(table.getState().rowSelection).length;
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [brightspaceFormat, setBrightspaceFormat] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const availableSimulations = simulations || [];

  // All available metrics
  const allMetrics = [
    "highestScore",
    "averageScore",
    "completionPercentage",
    "firstAttemptPassRate",
    "messagesPerSession",
    "personaResponseTimes",
    "sessionEfficiency",
    "stagnationRate",
    "timeSpent",
    "totalAttempts",
  ];

  // Reconstruct filters from URL search params
  const getCurrentFilters = (): AnalyticsFilters => {
    const params = new URLSearchParams(searchParams.toString());

    // Get default dates (30 days ago to now)
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const defaults = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: [] as string[],
      roles: [] as string[],
      simulationFilters: ["general" as const],
      departmentIds: [] as string[],
    };

    return searchParamsToFilters(params, defaults);
  };

  // Get selected profile IDs from table
  const getSelectedProfileIds = (): string[] => {
    const selectedRowsData =
      selectedRows > 0
        ? table.getFilteredSelectedRowModel().rows
        : table.getFilteredRowModel().rows;

    return selectedRowsData.map((row) => {
      const item = row.original as ReportsDataItem;
      return item.profile_id;
    });
  };

  // Get selected simulation IDs from faceted filter
  const getSelectedSimulationIds = (): string[] => {
    const simulationColumn = table.getColumn("simulation_id");
    const filterValue = simulationColumn?.getFilterValue() as
      | string[]
      | undefined;
    return filterValue || [];
  };

  // Get selected scenario IDs from faceted filter
  const getSelectedScenarioIds = (): string[] => {
    const scenarioColumn = table.getColumn("scenario_id");
    const filterValue = scenarioColumn?.getFilterValue() as
      | string[]
      | undefined;
    return filterValue || [];
  };

  // Handle export
  const handleExport = async () => {
    // For brightspace format, require at least one metric
    if (brightspaceFormat && selectedMetrics.length === 0) {
      toast?.error("Please select at least one metric for Brightspace export");
      return;
    }

    // For normal mode, default to all metrics if none selected
    const metricsToExport =
      selectedMetrics.length === 0 && !brightspaceFormat
        ? allMetrics
        : selectedMetrics;

    if (brightspaceFormat && availableSimulations.length === 0) {
      toast?.error("No simulations available for export");
      return;
    }

    try {
      setIsExporting(true);

      const filters = getCurrentFilters();
      const profileIds = getSelectedProfileIds();
      const simulationIds = getSelectedSimulationIds();
      const scenarioIds = getSelectedScenarioIds();

      const response = await fetch("/api/documents/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters,
          profileIds,
          simulationIds,
          scenarioIds,
          metrics: metricsToExport,
          brightspaceFormat,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: "Failed to export data",
        }));
        throw new Error(
          errorData.message || errorData.error || "Failed to export data"
        );
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("content-disposition");
      let filename = brightspaceFormat
        ? `reports_export_${new Date().toISOString().slice(0, 10)}.zip`
        : `reports_export_${new Date().toISOString().slice(0, 10)}.csv`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast?.success(
        `Exported ${profileIds.length} ${profileIds.length === 1 ? "row" : "rows"} successfully`
      );
      setExportPopoverOpen(false);
    } catch (error) {
      toast?.error(
        error instanceof Error ? error.message : "Failed to export data"
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Check if export button should be disabled
  // Disable only if brightspace format and no metrics selected
  const isExportDisabled =
    isExporting || (brightspaceFormat && selectedMetrics.length === 0);

  return (
    <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="default" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export {selectedRows > 0 ? `(${selectedRows})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" align="end">
        <div className="space-y-4">
          <div className="space-y-3">
            <ExportPicker
              selectedMetrics={selectedMetrics}
              onSelect={setSelectedMetrics}
              label="Metrics"
              placeholder={
                brightspaceFormat
                  ? "Choose at least one metric..."
                  : selectedMetrics.length === 0
                    ? "All metrics selected"
                    : "Select metrics to export..."
              }
              description="Choose one or more metrics to include in the export."
            />

            <div className="flex items-center space-x-2">
              <Checkbox
                id="brightspace"
                checked={brightspaceFormat}
                onCheckedChange={(checked) =>
                  setBrightspaceFormat(checked === true)
                }
              />
              <label
                htmlFor="brightspace"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Brightspace Format
              </label>
            </div>

            {brightspaceFormat && (
              <p className="text-xs text-muted-foreground">
                Brightspace format exports one CSV file per selected metric,
                packaged in a ZIP file. Each CSV follows Brightspace gradebook
                import format.
              </p>
            )}

            {!brightspaceFormat && (
              <p className="text-xs text-muted-foreground">
                Regular format exports a single CSV file with the selected
                metrics.
              </p>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleExport}
                      disabled={isExportDisabled}
                    >
                      {isExporting
                        ? "Exporting..."
                        : brightspaceFormat
                          ? "Export to ZIP"
                          : "Export to CSV"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {brightspaceFormat && selectedMetrics.length === 0 && (
                  <TooltipContent>
                    <p>Brightspace export requires at least one metric</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
