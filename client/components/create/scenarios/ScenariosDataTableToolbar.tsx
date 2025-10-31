"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScenarioItem } from "@/lib/api/v2/schemas/scenarios";

export interface ScenariosDataTableToolbarProps {
  table: Table<ScenarioItem>;
  cohortOptions: { value: string; label: string }[];
  personaOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  departmentOptions?: { value: string; label: string }[];
}

export function ScenariosDataTableToolbar({
  table,
  cohortOptions,
  personaOptions,
  simulationOptions,
  departmentOptions = [],
}: ScenariosDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const titleColumn = table.getColumn("title");
  const cohortColumn = table.getColumn("cohort_ids");
  const personaColumn = table.getColumn("persona_id");
  const simulationColumn = table.getColumn("simulation_ids");
  const departmentsColumn = table.getColumn("departments");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search scenarios..."
            value={(titleColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              titleColumn?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Simulation Filter */}
          {simulationColumn && simulationOptions.length > 0 && (
            <DataTableFacetedFilter
              column={simulationColumn}
              title="Simulation"
              options={simulationOptions}
            />
          )}

          {/* Cohort Filter */}
          {cohortColumn && cohortOptions.length > 0 && (
            <DataTableFacetedFilter
              column={cohortColumn}
              title="Cohort"
              options={cohortOptions}
            />
          )}

          {/* Persona Filter */}
          {personaColumn && personaOptions.length > 0 && (
            <DataTableFacetedFilter
              column={personaColumn}
              title="Persona"
              options={personaOptions}
            />
          )}

          {/* Department Filter */}
          {departmentsColumn && departmentOptions.length > 0 && (
            <DataTableFacetedFilter
              column={departmentsColumn}
              title="Department"
              options={departmentOptions}
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
    </div>
  );
}
