"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Profile } from "@/types";

export interface CohortStaffDataTableToolbarProps {
  table: Table<Profile>;
  roleOptions: { value: string; label: string }[];
}

export function CohortStaffDataTableToolbar({
  table,
  roleOptions,
}: CohortStaffDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const firstNameColumn = table.getColumn("firstName");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search staff by name or alias..."
            value={(firstNameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              firstNameColumn?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Performance Filter */}
          {roleOptions.length > 0 && table.getColumn("role") && (
            <DataTableFacetedFilter
              column={table.getColumn("role")!}
              title="Role"
              options={roleOptions}
            />
          )}

          {isFiltered && (
            <Button
              type="button"
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

      <div className="flex items-center space-x-2 mb-2">
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
