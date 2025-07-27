"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Parameter } from "@/types";

export interface ParametersDataTableToolbarProps {
  table: Table<Parameter>;
  typeOptions: { value: string; label: string }[];
  itemCountOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
}

export function ParametersDataTableToolbar({
  table,
  typeOptions,
  itemCountOptions,
  statusOptions,
  scenarioOptions,
}: ParametersDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const numericalColumn = table.getColumn("numerical");
  const itemCountColumn = table.getColumn("itemCount");
  const activeColumn = table.getColumn("active");
  const scenarioIdsColumn = table.getColumn("scenarioIds");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search parameters..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Type Filter */}
          {numericalColumn && typeOptions.length > 0 && (
            <DataTableFacetedFilter
              column={numericalColumn}
              title="Type"
              options={typeOptions}
            />
          )}

          {/* Item Count Filter */}
          {itemCountColumn && itemCountOptions.length > 0 && (
            <DataTableFacetedFilter
              column={itemCountColumn}
              title="Items"
              options={itemCountOptions}
            />
          )}

          {/* Status Filter */}
          {activeColumn && statusOptions.length > 0 && (
            <DataTableFacetedFilter
              column={activeColumn}
              title="Status"
              options={statusOptions}
            />
          )}

          {/* Scenario Filter */}
          {scenarioIdsColumn && scenarioOptions.length > 0 && (
            <DataTableFacetedFilter
              column={scenarioIdsColumn}
              title="Scenarios"
              options={scenarioOptions}
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
