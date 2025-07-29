"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rubric } from "@/types";

export interface RubricsDataTableToolbarProps {
  table: Table<Rubric>;
  passPointsOptions: { value: string; label: string }[];
  totalPointsOptions: { value: string; label: string }[];
  passPercentageOptions: { value: string; label: string }[];
}

export function RubricsDataTableToolbar({
  table,
  passPointsOptions,
  totalPointsOptions,
  passPercentageOptions,
}: RubricsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const pointsColumn = table.getColumn("points");
  const passPointsColumn = table.getColumn("passPoints");
  const passPercentageColumn = table.getColumn("passPercentage");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search rubrics..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Total Points Filter */}
          {pointsColumn && totalPointsOptions.length > 0 && (
            <DataTableFacetedFilter
              column={pointsColumn}
              title="Total Points"
              options={totalPointsOptions}
            />
          )}

          {/* Pass Points Filter */}
          {passPointsColumn && passPointsOptions.length > 0 && (
            <DataTableFacetedFilter
              column={passPointsColumn}
              title="Pass Points"
              options={passPointsOptions}
            />
          )}

          {/* Pass Percentage Filter */}
          {passPercentageColumn && passPercentageOptions.length > 0 && (
            <DataTableFacetedFilter
              column={passPercentageColumn}
              title="Pass %"
              options={passPercentageOptions}
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
