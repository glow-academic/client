"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { BrightspaceExportButton } from "@/components/common/history/BrightspaceExportButton";
import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAPerformanceData } from "@/hooks/use-report-columns";
import React from "react";

export interface ReportsDataTableToolbarProps {
  table: Table<TAPerformanceData>;
  roleOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  personaOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  simulations: Array<{ id: string; title: string }>;
  showExport?: boolean;
}

export function ReportsDataTableToolbar({
  table,
  roleOptions,
  cohortOptions,
  personaOptions,
  scenarioOptions,
  simulationOptions,
  simulations,
  showExport = true,
}: ReportsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const firstNameColumn = table.getColumn("firstName");
  const taCohortsColumn = table.getColumn("taCohorts");
  const roleColumn = table.getColumn("role");

  // Set default role filter to "ta" if no filter is applied
  React.useEffect(() => {
    if (!roleColumn?.getFilterValue()) {
      roleColumn?.setFilterValue(["ta"]);
    }
  }, [roleColumn]);

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
          {/* Role Filter */}
          {roleColumn && roleOptions.length > 0 && (
            <DataTableFacetedFilter
              column={roleColumn}
              title="Role"
              options={roleOptions}
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

          {/* Persona Filter */}
          {personaOptions.length > 0 && table.getColumn("personasTested") && (
            <DataTableFacetedFilter
              column={table.getColumn("personasTested")!}
              title="Persona"
              options={personaOptions}
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
          <BrightspaceExportButton table={table} simulations={simulations} />
        )}

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
