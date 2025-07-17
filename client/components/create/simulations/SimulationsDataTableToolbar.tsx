"use client";

import { Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Simulation } from "@/types";

export interface SimulationsDataTableToolbarProps {
  table: Table<Simulation>;
  cohortOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  rubricOptions: { value: string; label: string }[];
  timeLimitOptions: { value: string; label: string }[];
}

export function SimulationsDataTableToolbar({
  table,
  cohortOptions,
  scenarioOptions,
  rubricOptions,
  timeLimitOptions,
}: SimulationsDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search simulations..."
            value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("title")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px] pl-8"
          />
        </div>

        {table.getColumn("cohorts") && (
          <DataTableFacetedFilter
            column={table.getColumn("cohorts")!}
            title="Cohorts"
            options={cohortOptions}
          />
        )}

        {table.getColumn("scenarios") && (
          <DataTableFacetedFilter
            column={table.getColumn("scenarios")!}
            title="Scenarios"
            options={scenarioOptions}
          />
        )}

        {table.getColumn("rubric") && (
          <DataTableFacetedFilter
            column={table.getColumn("rubric")!}
            title="Rubric"
            options={rubricOptions}
          />
        )}

        {table.getColumn("timeLimit") && (
          <DataTableFacetedFilter
            column={table.getColumn("timeLimit")!}
            title="Time Limit"
            options={timeLimitOptions}
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
  );
}
