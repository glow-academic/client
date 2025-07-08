"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/data-table-faceted-filter";
import { DataTableViewOptions } from "@/components/common/history/data-table-view-options";
import { ExportButton } from "@/components/common/history/export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAPerformanceData } from "./reports-columns";

interface ReportsDataTableToolbarProps {
  table: Table<TAPerformanceData>;
  performanceOptions: { value: string; label: string }[];
  classOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  agentOptions: { value: string; label: string }[];
  showExport?: boolean;
}

export function ReportsDataTableToolbar({
  table,
  performanceOptions,
  classOptions,
  cohortOptions,
  agentOptions: _agentOptions,
  showExport = true,
}: ReportsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const firstNameColumn = table.getColumn("firstName");
  const avgScoreColumn = table.getColumn("avgScore");
  const taCohortsColumn = table.getColumn("taCohorts");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search TAs by name or alias..."
          value={(firstNameColumn?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            firstNameColumn?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />

        {/* Performance Filter */}
        {avgScoreColumn && performanceOptions.length > 0 && (
          <DataTableFacetedFilter
            column={avgScoreColumn}
            title="Performance"
            options={performanceOptions}
          />
        )}

        {/* Class Filter - Note: This would need to be implemented based on profile data */}
        {/* For now, we'll skip this as it requires more complex filtering logic */}

        {/* Cohort Filter */}
        {taCohortsColumn && cohortOptions.length > 0 && (
          <DataTableFacetedFilter
            column={taCohortsColumn}
            title="Cohort"
            options={cohortOptions}
          />
        )}

        {/* Agent Filter - Note: This would need to be implemented based on scenario data */}
        {/* For now, we'll skip this as it requires more complex filtering logic */}

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

      <div className="flex items-center space-x-2">
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
