"use client";

import { Table } from "@tanstack/react-table";
import { Grid3X3, List, X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Document } from "@/types";

export interface DocumentsDataTableToolbarProps {
  table: Table<Document>;
  typeOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  extensionOptions: { value: string; label: string }[];
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}

export function DocumentsDataTableToolbar({
  table,
  typeOptions,
  scenarioOptions,
  extensionOptions,
  viewMode,
  onViewModeChange,
}: DocumentsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const typeColumn = table.getColumn("type");
  const scenarioColumn = table.getColumn("scenarioIds");
  const extensionColumn = table.getColumn("extension");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search documents..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Type Filter */}
          {typeColumn && typeOptions.length > 0 && (
            <DataTableFacetedFilter
              column={typeColumn}
              title="Type"
              options={typeOptions}
            />
          )}

          {/* Scenario Filter */}
          {scenarioColumn && scenarioOptions.length > 0 && (
            <DataTableFacetedFilter
              column={scenarioColumn}
              title="Scenario"
              options={scenarioOptions}
            />
          )}

          {/* Extension Filter */}
          {extensionColumn && extensionOptions.length > 0 && (
            <DataTableFacetedFilter
              column={extensionColumn}
              title="Extension"
              options={extensionOptions}
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

      <div className="flex items-center space-x-2 mb-2">
        {/* View Toggle */}
        <div className="flex border rounded-md">
          <Button
            type="button"
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("grid")}
            className="rounded-r-none"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("list")}
            className="rounded-l-none border-l"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* Column Visibility Options */}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
