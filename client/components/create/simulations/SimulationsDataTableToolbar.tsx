"use client";

import { Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimulationItem } from "@/lib/api/v2/schemas/simulations";

export interface SimulationsDataTableToolbarProps {
  table: Table<SimulationItem>;
  scenarioOptions: { value: string; label: string }[];
  rubricOptions: { value: string; label: string }[];
  timeLimitOptions: { value: string; label: string }[];
  departmentOptions?: { value: string; label: string }[];
}

export function SimulationsDataTableToolbar({
  table,
  scenarioOptions,
  rubricOptions,
  timeLimitOptions,
  departmentOptions = [],
}: SimulationsDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const scenarioColumn = table.getColumn("scenario_ids");
  const rubricColumn = table.getColumn("rubric_id");
  const timeLimitColumn = table.getColumn("time_limit_category");
  const departmentsColumn = table.getColumn("departments");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search simulations..."
              value={(nameColumn?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                nameColumn?.setFilterValue(event.target.value)
              }
              className="h-8 w-[150px] lg:w-[250px] pl-8"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Scenario Filter */}
          {scenarioColumn && scenarioOptions.length > 0 && (
            <DataTableFacetedFilter
              column={scenarioColumn}
              title="Scenario"
              options={scenarioOptions}
            />
          )}

          {/* Rubric Filter */}
          {rubricColumn && rubricOptions.length > 0 && (
            <DataTableFacetedFilter
              column={rubricColumn}
              title="Rubric"
              options={rubricOptions}
            />
          )}

          {/* Time Limit Filter */}
          {timeLimitColumn && timeLimitOptions.length > 0 && (
            <DataTableFacetedFilter
              column={timeLimitColumn}
              title="Time Limit"
              options={timeLimitOptions}
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
