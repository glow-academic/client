"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scenario } from "@/types";

export interface ScenariosDataTableToolbarProps {
  table: Table<Scenario>;
  simulationOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  agentOptions: { value: string; label: string }[];
  scenarioTypeOptions: { value: string; label: string }[];
}

export function ScenariosDataTableToolbar({
  table,
  simulationOptions,
  cohortOptions,
  agentOptions,
  scenarioTypeOptions,
}: ScenariosDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const simulationColumn = table.getColumn("simulationIds");
  const cohortColumn = table.getColumn("cohortIds");
  const agentColumn = table.getColumn("agentId");
  const scenarioTypeColumn = table.getColumn("scenarioType");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search scenarios..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
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

          {/* Agent Filter */}
          {agentColumn && agentOptions.length > 0 && (
            <DataTableFacetedFilter
              column={agentColumn}
              title="Agent"
              options={agentOptions}
            />
          )}

          {/* Scenario Type Filter */}
          {scenarioTypeColumn && scenarioTypeOptions.length > 0 && (
            <DataTableFacetedFilter
              column={scenarioTypeColumn}
              title="Type"
              options={scenarioTypeOptions}
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
