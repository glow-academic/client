"use client";

import { Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Department } from "@/types";

export interface DepartmentsDataTableToolbarProps {
  table: Table<Department>;
  departmentCodeOptions: { value: string; label: string }[];
  profileOptions: { value: string; label: string }[];
  classCountOptions: { value: string; label: string }[];
  locationCountOptions: { value: string; label: string }[];
}

export function DepartmentsDataTableToolbar({
  table,
  departmentCodeOptions,
  profileOptions,
  classCountOptions,
  locationCountOptions,
}: DepartmentsDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search departments..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px] pl-8"
          />
        </div>

        {table.getColumn("departmentCode") && (
          <DataTableFacetedFilter
            column={table.getColumn("departmentCode")!}
            title="Department Code"
            options={departmentCodeOptions}
          />
        )}

        {table.getColumn("profiles") && (
          <DataTableFacetedFilter
            column={table.getColumn("profiles")!}
            title="Profiles"
            options={profileOptions}
          />
        )}

        {table.getColumn("classCount") && (
          <DataTableFacetedFilter
            column={table.getColumn("classCount")!}
            title="Classes"
            options={classCountOptions}
          />
        )}

        {table.getColumn("locationCount") && (
          <DataTableFacetedFilter
            column={table.getColumn("locationCount")!}
            title="Locations"
            options={locationCountOptions}
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
