"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/data-table-faceted-filter";
import { DataTableViewOptions } from "@/components/common/history/data-table-view-options";
import { ExportButton } from "@/components/common/history/export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAPerformanceData } from "@/hooks/use-report-columns";

export interface ReportsDataTableToolbarProps {
  table: Table<TAPerformanceData>;
  performanceOptions: { value: string; label: string }[];
  classOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  agentOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  showExport?: boolean;
}

export function ReportsDataTableToolbar({
  table,
  performanceOptions,
  classOptions,
  cohortOptions,
  agentOptions,
  scenarioOptions,
  simulationOptions,
  showExport = true,
}: ReportsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const firstNameColumn = table.getColumn("firstName");
  const avgScoreColumn = table.getColumn("avgScore");
  const taCohortsColumn = table.getColumn("taCohorts");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search TAs by name or alias..."
            value={(firstNameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              firstNameColumn?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Performance Filter */}
          {avgScoreColumn && performanceOptions.length > 0 && (
            <DataTableFacetedFilter
              column={avgScoreColumn}
              title="Performance"
              options={performanceOptions}
            />
          )}

          {/* Class Filter */}
          {classOptions.length > 0 && table.getColumn("classIds") && (
            <DataTableFacetedFilter
              column={table.getColumn("classIds")!}
              title="Class"
              options={classOptions}
            />
          )}

          {/* Cohort Filter */}
          {taCohortsColumn && cohortOptions.length > 0 && (
            <DataTableFacetedFilter
              column={taCohortsColumn}
              title="Cohort"
              options={cohortOptions}
            />
          )}

          {/* Agent Filter */}
          {agentOptions.length > 0 && table.getColumn("agentsTested") && (
            <DataTableFacetedFilter
              column={table.getColumn("agentsTested")!}
              title="Agent"
              options={agentOptions}
            />
          )}

          {/* Scenario Filter */}
          {scenarioOptions.length > 0 && table.getColumn("scenarioIds") && (
            <DataTableFacetedFilter
              column={table.getColumn("scenarioIds")!}
              title="Scenario"
              options={scenarioOptions}
            />
          )}

          {/* Simulation Filter */}
          {simulationOptions.length > 0 && table.getColumn("simulationIds") && (
            <DataTableFacetedFilter
              column={table.getColumn("simulationIds")!}
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
          <ExportButton
            table={table}
            profileOptions={[]} // Will be populated from the data
            classOptions={classOptions}
          />
        )}

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
