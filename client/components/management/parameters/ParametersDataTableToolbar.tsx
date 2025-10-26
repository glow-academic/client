"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParameterItem } from "@/lib/api/v2/schemas/parameters";

export interface ParametersDataTableToolbarProps {
  table: Table<ParameterItem>;
}

export function ParametersDataTableToolbar({
  table,
}: ParametersDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const typeColumn = table.getColumn("numerical");
  const itemCountColumn = table.getColumn("num_items");
  const statusColumn = table.getColumn("active");

  const typeOptions = [
    { value: "true", label: "Numerical" },
    { value: "false", label: "Text" },
  ];

  const itemCountOptions = [
    { value: "0", label: "0 items" },
    { value: "1-3", label: "1-3 items" },
    { value: "4-6", label: "4-6 items" },
    { value: "7+", label: "7+ items" },
  ];

  const statusOptions = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ];

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
          {typeColumn && (
            <DataTableFacetedFilter
              column={typeColumn}
              title="Type"
              options={typeOptions}
            />
          )}

          {itemCountColumn && (
            <DataTableFacetedFilter
              column={itemCountColumn}
              title="Items"
              options={itemCountOptions}
            />
          )}

          {statusColumn && (
            <DataTableFacetedFilter
              column={statusColumn}
              title="Status"
              options={statusOptions}
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
