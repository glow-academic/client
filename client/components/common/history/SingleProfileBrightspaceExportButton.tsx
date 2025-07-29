"use client";

import { useQuery } from "@tanstack/react-query";
import { Table } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { logError } from "@/utils/logger";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { toast } from "sonner";

// Enhanced attempt data structure from history table
interface EnhancedAttempt {
  id: string;
  profileId: string;
  simulationId: string;
  createdAt: string;
  chats: Array<{
    id: string;
    completed: boolean;
    hasRubric?: boolean;
    score?: number;
  }>;
  averageScore: number;
  [key: string]: unknown;
}

export interface SingleProfileBrightspaceExportButtonProps<TData> {
  table: Table<TData>;
  profileOptions: { value: string; label: string }[];
}

export function SingleProfileBrightspaceExportButton<TData>({
  table,
  profileOptions,
}: SingleProfileBrightspaceExportButtonProps<TData>) {
  const selectedRows = Object.keys(table.getState().rowSelection).length;
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false);

  // Fetch cohorts and simulations data
  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  // Function to export to CSV for Brightspace with highest scores per simulation
  const handleBrightspaceExport = () => {
    try {
      // Get all checked rows
      const selectedData =
        selectedRows > 0
          ? table.getFilteredSelectedRowModel().rows
          : table.getFilteredRowModel().rows;

      if (selectedData.length === 0) {
        toast?.error("No data to export");
        return;
      }

      // Get the first profile from the selected data
      const firstRow = selectedData[0];
      if (!firstRow) {
        toast?.error("No data to export");
        return;
      }
      const profileId = firstRow.getValue("profileId") as string;
      const profileOption = profileOptions.find(
        (profile) => profile.value === profileId
      );
      const profileAlias = profileOption?.label || profileId;

      // Find all cohorts that contain this profile
      const profileCohorts = cohorts.filter((cohort) =>
        cohort.profileIds.includes(profileId)
      );

      // Get all simulation IDs assigned to this profile through their cohorts
      const assignedSimulationIds = new Set<string>();
      profileCohorts.forEach((cohort) => {
        cohort.simulationIds.forEach((simId) => {
          if (simId !== "RAY") {
            // Exclude placeholder
            assignedSimulationIds.add(simId);
          }
        });
      });

      // Get simulation titles for all assigned simulations
      const assignedSimulations = simulations.filter((sim) =>
        assignedSimulationIds.has(sim.id)
      );

      // Group attempts by simulation and find the highest score for each
      const simulationScores = new Map<
        string,
        { title: string; highestScore: number }
      >();

      // Initialize all assigned simulations with 0 score
      assignedSimulations.forEach((sim) => {
        simulationScores.set(sim.id, {
          title: sim.title,
          highestScore: 0,
        });
      });

      // Update scores from actual attempts
      selectedData.forEach((row) => {
        const attempt = row.original as EnhancedAttempt;
        const simulationId = attempt.simulationId;
        const averageScore = attempt.averageScore;

        if (simulationScores.has(simulationId)) {
          const existing = simulationScores.get(simulationId)!;
          if (averageScore > existing.highestScore) {
            existing.highestScore = averageScore;
          }
        }
      });

      // Create CSV header: Alias, Simulation1, Simulation2, etc.
      const selectedSimulations = Array.from(simulationScores.values());
      const headerRow = [
        "Alias",
        ...selectedSimulations.map((sim) => sim.title),
      ].join(",");

      // Create CSV row with profile alias and scores
      const scoreValues = selectedSimulations.map((sim) => {
        if (sim.highestScore === 0) {
          return ""; // Empty cell if no attempts
        }
        return `${Math.round(sim.highestScore)}%`;
      });

      const csvRow = [profileAlias, ...scoreValues].join(",");

      // Combine header and row
      const csvData = [headerRow, csvRow].join("\n");

      // Create a Blob for the CSV
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });

      // Create a temporary link element to download the file
      const today = new Date();
      const filename = `brightspace_single_profile_export_${today.toISOString().slice(0, 10)}.csv`;

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast?.success(`Exported scores for ${profileAlias} to Brightspace CSV`);
      setExportPopoverOpen(false);
    } catch (error) {
      logError("Error exporting to Brightspace CSV:", error);
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

            <p className="text-xs text-muted-foreground">
              Exports CSV with profile alias as first column and all assigned
              simulation names as headers. Shows the highest score achieved for
              each simulation. Empty cells indicate no attempts.
            </p>

            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                className="w-full"
                onClick={handleBrightspaceExport}
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
