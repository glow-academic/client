"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RubricItem } from "@/lib/api/v2/schemas/rubrics";

export interface RubricsDataTableToolbarProps {
  table: Table<RubricItem>;
  departmentOptions: { value: string; label: string }[];
  passPointsOptions: { value: string; label: string }[];
  totalPointsOptions: { value: string; label: string }[];
  passPercentageOptions: { value: string; label: string }[];
}

export function RubricsDataTableToolbar({
  table,
  departmentOptions,
  passPointsOptions,
  totalPointsOptions,
  passPercentageOptions,
}: RubricsDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const passPointsColumn = table.getColumn("passPoints");
  const pointsColumn = table.getColumn("points");
  const passPercentageColumn = table.getColumn("passPercentage");
  const departmentsColumn = table.getColumn("departments");

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
          {passPointsColumn && passPointsOptions.length > 0 && (
            <DataTableFacetedFilter
              column={passPointsColumn}
              title="Pass Points"
              options={passPointsOptions}
            />
          )}

          {pointsColumn && totalPointsOptions.length > 0 && (
            <DataTableFacetedFilter
              column={pointsColumn}
              title="Total Points"
              options={totalPointsOptions}
            />
          )}

          {passPercentageColumn && passPercentageOptions.length > 0 && (
            <DataTableFacetedFilter
              column={passPercentageColumn}
              title="Pass %"
              options={passPercentageOptions}
            />
          )}

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
