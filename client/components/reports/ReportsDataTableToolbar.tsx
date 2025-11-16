"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportButton } from "./ExportButton";
// Import ReportsDataItem type
interface ReportsDataItem {
  profile_id: string;
  profileName: string;
  profileAlias: string;
  scenario_id?: string;
  simulation_id?: string;
  averageScore: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      mean: number;
      median: number;
      mode: number;
    };
  };
  completionPercentage: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      completed: number;
      total: number;
      percent: number;
    };
  };
  firstAttemptPassRate: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      passed: number;
      total: number;
      percent: number;
    };
  };
  highestScore: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      top: number[];
    };
  };
  messagesPerSession: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      mean: number;
      median: number;
      count: number;
    };
  };
  personaResponseTimes: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      meanSeconds: number;
      medianSeconds: number;
      samples: number;
    };
  };
  sessionEfficiency: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      avgScorePercent: number;
      avgMinutes: number;
      efficiency: number;
    };
  };
  stagnationRate: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      tracked: number;
      stagnant: number;
      ratePercent: number;
    };
  };
  timeSpent: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      avgSessionMinutes: number;
      avgChatMinutes: number;
      avgOverallMinutes: number;
    };
  };
  totalAttempts: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
  };
}

export interface ReportsDataTableToolbarProps {
  table: Table<ReportsDataItem>;
  profileOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  simulations: Array<{ id: string; title: string }>;
  showExport?: boolean;
}

export function ReportsDataTableToolbar({
  table,
  profileOptions,
  scenarioOptions,
  simulationOptions,
  simulations,
  showExport = true,
}: ReportsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const profileNameColumn = table.getColumn("profileName");
  const profileIdColumn = table.getColumn("profileId");
  const scenariosColumn = table.getColumn("scenarios");
  const simulationsColumn = table.getColumn("simulations");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search profiles by name or alias..."
            value={(profileNameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              profileNameColumn?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Name Filter */}
          {profileIdColumn && profileOptions.length > 0 && (
            <DataTableFacetedFilter
              column={profileIdColumn}
              title="Name"
              options={profileOptions}
            />
          )}

          {/* Scenario Filter */}
          {scenariosColumn && scenarioOptions.length > 0 && (
            <DataTableFacetedFilter
              column={scenariosColumn}
              title="Scenario"
              options={scenarioOptions}
            />
          )}

          {/* Simulation Filter */}
          {simulationsColumn && simulationOptions.length > 0 && (
            <DataTableFacetedFilter
              column={simulationsColumn}
              title="Simulation"
              options={simulationOptions}
            />
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => table.resetColumnFilters()}
              className="h-8 px-2 lg:px-3"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-2">
        {showExport && (
          <ExportButton table={table} simulations={simulations} />
        )}

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
