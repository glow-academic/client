"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonaItem } from "@/lib/api/v2/schemas/personas";

export interface PersonasDataTableToolbarProps {
  table: Table<PersonaItem>;
  scenarioOptions: { value: string; label: string }[];
  reasoningOptions: { value: string; label: string }[];
  modelOptions: { value: string; label: string }[];
  temperatureOptions: { value: string; label: string }[];
  departmentOptions?: { value: string; label: string }[];
}

export function PersonasDataTableToolbar({
  table,
  scenarioOptions,
  reasoningOptions,
  modelOptions,
  temperatureOptions,
  departmentOptions = [],
}: PersonasDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const reasoningColumn = table.getColumn("reasoning");
  const modelColumn = table.getColumn("modelId");
  const temperatureColumn = table.getColumn("temperature");

  // Add a custom scenario filter column
  const scenarioColumn = table.getColumn("scenarios");
  const departmentsColumn = table.getColumn("departments");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search personas..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
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

          {/* Reasoning Filter */}
          {reasoningColumn && reasoningOptions.length > 0 && (
            <DataTableFacetedFilter
              column={reasoningColumn}
              title="Reasoning"
              options={reasoningOptions}
            />
          )}

          {/* Model Filter */}
          {modelColumn && modelOptions.length > 0 && (
            <DataTableFacetedFilter
              column={modelColumn}
              title="Model"
              options={modelOptions}
            />
          )}

          {/* Temperature Filter */}
          {temperatureColumn && temperatureOptions.length > 0 && (
            <DataTableFacetedFilter
              column={temperatureColumn}
              title="Temperature"
              options={temperatureOptions}
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
