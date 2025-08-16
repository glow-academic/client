"use client";

import { useQuery } from "@tanstack/react-query";
import { Table } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnalytics } from "@/contexts/analytics-context";
import { log } from "@/utils/logger";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { toast } from "sonner";

// TAPerformanceData interface for Reports page
interface TAPerformanceData {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  // The 10 metrics from header components
  averageScore: number;
  completionPercentage: number;
  firstAttemptPassRate: number;
  highestScore: number;
  messagesPerSession: number;
  personaResponseTimes: number;
  sessionEfficiency: number;
  stagnationRate: number;
  timeSpent: number;
  totalAttempts: number;
  // Additional fields for filtering
  personasTested: string[];
  scenarioIds: string[];
  simulationIds: string[];
  hasNoSessions: boolean;
  [key: string]: unknown;
}

// Metric options for the select dropdown
const metricOptions = [
  { value: "highestScore", label: "Highest Score", unit: "%" },
  { value: "averageScore", label: "Average Score", unit: "%" },
  { value: "completionPercentage", label: "Completion Percentage", unit: "%" },
  {
    value: "firstAttemptPassRate",
    label: "First Attempt Pass Rate",
    unit: "%",
  },
  { value: "messagesPerSession", label: "Messages Per Session", unit: "" },
  { value: "personaResponseTimes", label: "Persona Response Times", unit: "m" },
  { value: "sessionEfficiency", label: "Session Efficiency", unit: "%" },
  { value: "stagnationRate", label: "Stagnation Rate", unit: "%" },
  { value: "timeSpent", label: "Time Spent", unit: "m" },
  { value: "totalAttempts", label: "Total Attempts", unit: "" },
];

export interface BrightspaceExportButtonProps<TData> {
  table: Table<TData>;
  simulations: Array<{ id: string; title: string }>;
}

export function BrightspaceExportButton<TData>({
  table,
  simulations,
}: BrightspaceExportButtonProps<TData>) {
  const selectedRows = Object.keys(table.getState().rowSelection).length;
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>("");

  // Get analytics context for cohort filtering
  const { selectedCohortIds } = useAnalytics();

  // Fetch cohorts to filter simulations based on effective cohort IDs
  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Filter simulations based on effective cohort IDs
  const filteredSimulations = useMemo(() => {
    if (!selectedCohortIds || selectedCohortIds.length === 0) {
      return simulations; // If no cohort filtering, return all simulations
    }

    // Get all simulation IDs from the effective cohorts
    const cohortSimulationIds = new Set<string>();
    const selectedCohorts = cohorts.filter((cohort) =>
      selectedCohortIds.includes(cohort.id)
    );

    selectedCohorts.forEach((cohort) => {
      cohort.simulationIds.forEach((simId) => {
        if (simId !== "RAY") {
          // Exclude placeholder
          cohortSimulationIds.add(simId);
        }
      });
    });

    // Filter simulations to only include those in the effective cohorts
    return simulations.filter((simulation) =>
      cohortSimulationIds.has(simulation.id)
    );
  }, [simulations, selectedCohortIds, cohorts]);

  // Function to export to CSV for Brightspace
  const handleBrightspaceExport = () => {
    if (!selectedMetric) {
      toast?.error("Please select a metric to export");
      return;
    }

    try {
      // Get all checked rows
      const selectedData =
        selectedRows > 0
          ? table.getFilteredSelectedRowModel().rows
          : table.getFilteredRowModel().rows;

      // Get the metric option
      const metricOption = metricOptions.find(
        (m) => m.value === selectedMetric
      );
      if (!metricOption) {
        toast?.error("Invalid metric selected");
        return;
      }

      // Create CSV header: Username, Simulation1 Points Grade, Simulation2 Points Grade, etc.
      const headerRow = [
        "Username",
        ...filteredSimulations.map(
          (sim: { id: string; title: string }) =>
            `${sim.title} Points Grade <Numeric MaxPoints:100>`
        ),
        "End-of-Line Indicator",
      ].join(",");

      // Create CSV rows
      const csvRows = selectedData.map((row) => {
        const ta = row.original as TAPerformanceData;
        const alias = ta.username;

        // For each simulation, check if the user has attempted it
        const simulationValues = filteredSimulations.map(
          (simulation: { id: string; title: string }) => {
            const hasAttempted = ta.simulationIds.includes(simulation.id);
            if (!hasAttempted) {
              return ""; // Empty cell if not attempted
            }

            // Get the metric value
            const metricValue = ta[selectedMetric];
            if (metricValue === undefined || metricValue === null) {
              return "";
            }

            // Format the value based on the metric type
            if (ta.hasNoSessions) {
              return "N/A";
            }

            if (typeof metricValue === "number") {
              return metricOption.unit
                ? `${metricValue}${metricOption.unit}`
                : `${metricValue}`;
            }

            return String(metricValue);
          }
        );

        return [alias, ...simulationValues, "#"].join(",");
      });

      // Combine header and rows
      const csvData = [headerRow, ...csvRows].join("\n");

      // Create a Blob for the CSV
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });

      // Create a temporary link element to download the file
      const today = new Date();
      const filename = `brightspace_export_${today.toISOString().slice(0, 10)}.csv`;

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast?.success(`Exported ${selectedData.length} rows to Brightspace CSV`);
      setExportPopoverOpen(false);
    } catch (error) {
      log.error("export.brightspace.failed", {
        message: "Error exporting to Brightspace CSV",
        error,
        context: { component: "BrightspaceExportButton" },
      });
      toast?.error("Failed to export data");
    }
  };

  return (
    <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="default" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Brightspace Export {selectedRows > 0 ? `(${selectedRows})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Brightspace Export</h4>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {selectedRows > 0
                ? `Exporting ${selectedRows} selected rows`
                : "Exporting all filtered rows"}
            </div>

            <div className="space-y-2">
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a metric to export" />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              We will populate each entry with the selected metric.
            </p>

            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                className="w-full"
                onClick={handleBrightspaceExport}
                disabled={!selectedMetric}
              >
                Export to CSV
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
