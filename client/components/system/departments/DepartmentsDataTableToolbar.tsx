"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DepartmentItem } from "@/lib/api/v2/schemas/departments";

export interface DepartmentsDataTableToolbarProps {
  table: Table<DepartmentItem>;
  priceSpentOptions: { value: string; label: string }[];
  staffCountOptions: { value: string; label: string }[];
}

export function DepartmentsDataTableToolbar({
  table,
  priceSpentOptions,
  staffCountOptions,
}: DepartmentsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("title");
  const priceSpentColumn = table.getColumn("total_price_spent");
  const staffCountColumn = table.getColumn("staff_count");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search departments..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Price Spent Filter */}
          {priceSpentColumn && priceSpentOptions.length > 0 && (
            <DataTableFacetedFilter
              column={priceSpentColumn}
              title="Price Spent"
              options={priceSpentOptions}
            />
          )}

          {/* Staff Count Filter */}
          {staffCountColumn && staffCountOptions.length > 0 && (
            <DataTableFacetedFilter
              column={staffCountColumn}
              title="Staff Count"
              options={staffCountOptions}
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
