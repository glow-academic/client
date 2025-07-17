"use client";

import { Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Class } from "@/types";

export interface ClassesDataTableToolbarProps {
  table: Table<Class>;
  yearOptions: { value: string; label: string }[];
  termOptions: { value: string; label: string }[];
  profileOptions: { value: string; label: string }[];
  documentCountOptions: { value: string; label: string }[];
}

export function ClassesDataTableToolbar({
  table,
  yearOptions,
  termOptions,
  profileOptions,
  documentCountOptions,
}: ClassesDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px] pl-8"
          />
        </div>

        {table.getColumn("year") && (
          <DataTableFacetedFilter
            column={table.getColumn("year")!}
            title="Year"
            options={yearOptions}
          />
        )}

        {table.getColumn("term") && (
          <DataTableFacetedFilter
            column={table.getColumn("term")!}
            title="Term"
            options={termOptions}
          />
        )}

        {table.getColumn("profiles") && (
          <DataTableFacetedFilter
            column={table.getColumn("profiles")!}
            title="Profiles"
            options={profileOptions}
          />
        )}

        {table.getColumn("documentCount") && (
          <DataTableFacetedFilter
            column={table.getColumn("documentCount")!}
            title="Documents"
            options={documentCountOptions}
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
